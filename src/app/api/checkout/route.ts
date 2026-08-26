import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { checkoutPublicSchema } from "@/lib/validations/billing"
import { normalizeAcquisitionAdvisorId } from "@/lib/acquisition-sources"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import { workshopCodeCandidate } from "@/lib/workshop-code"
import type { BillingCycle } from "@prisma/client"
import { computeTrialEnd, type PlanTier } from "@/lib/plan"

const MAX_ATTEMPTS = 5
const MAX_REF_RETRIES = 5
const WINDOW_MS = 10 * 60_000

const GENERIC_ERROR = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin."

/**
 * Public direct purchase. Creates an isolated Workshop + owner User that is
 * `approved` immediately — the owner can sign in and use the app on its 7-day
 * trial right away — plus a pending-payment BillingOrder. BakımX confirming
 * the havale in /admin activates the requested paid plan (switches
 * subscriptionStatus to `active`); it no longer gates access. No session is
 * created here.
 */
export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = await rateLimit(`checkout:${ip}`, MAX_ATTEMPTS, WINDOW_MS)
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
  const acquisitionAdvisorId = normalizeAcquisitionAdvisorId(data.acquisitionAdvisorId)
  if (data.acquisitionSource === "sales_advisor" && !acquisitionAdvisorId) {
    return NextResponse.json({ error: "Satış temsilcisi seçimi zorunludur." }, { status: 400 })
  }
  if (acquisitionAdvisorId) {
    const advisor = await prisma.salesAdvisor.findFirst({ where: { id: acquisitionAdvisorId, disabledAt: null }, select: { id: true } })
    if (!advisor) return NextResponse.json({ error: "Etkin satış temsilcisi bulunamadı." }, { status: 400 })
  }

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
    district: data.district ?? "",
    workshopEmail: data.workshopEmail ?? "",
  }

  // Çalışma saatleri — register API ile aynı mantık
  const workingDaysArr = data.workingDays
    ? data.workingDays.split(",").map((d) => parseInt(d, 10))
    : [1, 2, 3, 4, 5]
  const weekdayDays = workingDaysArr.filter((d) => d >= 1 && d <= 5).join(",")
  const weekendDays = workingDaysArr.filter((d) => d === 0 || d === 6).join(",")

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)
    const now = new Date()

    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
      const reference = generateOrderReference()
      // İş yeri giriş kodu (BAK-40). İlk deneme sade slug'ı ister; çakışma
      // olursa sonraki tur rastgele sonekli adayı dener — `reference` ile aynı
      // P2002-yeniden-dene döngüsünü paylaşır.
      const loginCode = workshopCodeCandidate(data.workshopName, attempt)
      try {
        await prisma.$transaction(async (tx) => {
          const workshop = await tx.workshop.create({
            data: {
              loginCode,
              name: data.workshopName,
              phone: data.phone,
              city: data.city,
              district: data.district || null,
              address: data.address,
              email: data.workshopEmail || data.email,
              invoiceTitle: data.invoiceTitle,
              taxNumber: data.taxNumber,
              taxOffice: data.taxOffice || null,
              // Instant activation: the owner can sign in right away on the
              // trial. The pending havale only gates the paid plan upgrade.
              approvalStatus: "approved",
              subscriptionStatus: "trialing",
              trialStartedAt: now,
              trialEndsAt: computeTrialEnd(now),
              planTier: "pro",
              acquisitionSource: data.acquisitionSource,
              acquisitionAdvisorId,
              requestedPlanTier: tier,
              planRequestedAt: now,
              settings: {
                create: {
                  weekdayStart: data.weekdayStart || "09:00",
                  weekdayEnd: data.weekdayEnd || "18:00",
                  weekdayWorkingDays: weekdayDays || "1,2,3,4,5",
                  weekendStart: data.weekdayStart || "09:00",
                  weekendEnd: data.weekdayEnd || "18:00",
                  weekendWorkingDays: weekendDays || "",
                },
              },
            },
          })
          const ownerTechnician = await tx.technician.create({
            data: {
              workshopId: workshop.id,
              fullName: `${data.firstName} ${data.lastName}`.trim(),
              phone: data.phone,
              role: "yonetici",
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
              technicianId: ownerTechnician.id,
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
              method: data.method,
              reference,
              billingSnapshot,
            },
          })
        })
        return NextResponse.json({ success: true, reference, amountMinor, method: data.method })
      } catch (err) {
        const e = err as { code?: string; meta?: { target?: string[] | string } }
        if (e.code === "P2002") {
          const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target ?? "")
          if (target.toLowerCase().includes("email")) throw err // duplicate email → outer catch maps to 409
          continue // reference / loginCode collision (or unknown unique) → retry, bounded
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
