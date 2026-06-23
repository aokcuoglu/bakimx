import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { checkoutPublicSchema } from "@/lib/validations/billing"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import type { BillingCycle } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"

const MAX_ATTEMPTS = 5
const MAX_REF_RETRIES = 5
const WINDOW_MS = 10 * 60_000

const GENERIC_ERROR = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin."

/**
 * Public direct purchase. Creates an isolated Workshop + owner User in `pending`
 * approval (no access) plus a pending-payment BillingOrder. BakımX confirms the
 * havale in /admin, which doubles as approval and activates the plan. No session
 * is created here.
 */
export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`checkout:${ip}`, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin." }, { status: 429 })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const normalized = {
    ...raw,
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
  }
  const parsed = checkoutPublicSchema.safeParse(normalized)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }, { status: 400 })
  }
  const data = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." }, { status: 409 })
  }

  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle
  const amountMinor = getPlanPriceMinor(tier, cycle)
  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: data.workshopName,
    address: data.address,
    email: data.email,
    phone: data.phone,
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)

    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
      const reference = generateOrderReference()
      try {
        await prisma.$transaction(async (tx) => {
          const workshop = await tx.workshop.create({
            data: {
              name: data.workshopName,
              phone: data.phone,
              city: data.city,
              address: data.address,
              email: data.email,
              invoiceTitle: data.invoiceTitle,
              taxNumber: data.taxNumber,
              taxOffice: data.taxOffice || null,
              // No access until BakımX confirms the havale (which approves it).
              approvalStatus: "pending",
              subscriptionStatus: "trialing",
              planTier: "pro",
              requestedPlanTier: tier,
              planRequestedAt: new Date(),
              settings: { create: {} },
            },
          })
          await tx.user.create({
            data: {
              email: data.email,
              password: passwordHash,
              firstName: data.firstName,
              lastName: data.lastName,
              workshopId: workshop.id,
              role: "owner",
            },
          })
          await tx.billingOrder.create({
            data: {
              workshopId: workshop.id,
              type: "new_purchase",
              planTier: tier,
              billingCycle: cycle,
              amountMinor,
              status: "pending_payment",
              method: "havale",
              reference,
              billingSnapshot,
            },
          })
        })
        return NextResponse.json({ success: true, reference, amountMinor })
      } catch (err) {
        const e = err as { code?: string; meta?: { target?: string[] | string } }
        if (e.code === "P2002") {
          const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target ?? "")
          if (target.toLowerCase().includes("email")) throw err // duplicate email → outer catch maps to 409
          continue // reference collision (or unknown unique) → retry, bounded
        }
        throw err
      }
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." }, { status: 409 })
    }
    console.error("[checkout] failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
