import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { registerSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"

/**
 * Self-serve workshop registration (early-access, approval-gated).
 *
 * Creates a new isolated Workshop + its first owner User, but leaves the
 * workshop in `pending` approval and `trialing` status. The account CANNOT sign
 * in until an admin approves it (which starts the 15-day trial). No session is
 * created here.
 */

const REGISTER_MAX_ATTEMPTS = 5
const REGISTER_WINDOW_MS = 10 * 60_000 // 10 minutes

const GENERIC_ERROR = "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin."
const PENDING_MESSAGE =
  "Başvurunuz alındı. Hesabınız onaylandığında e-posta ile bilgilendirileceksiniz ve 15 günlük deneme süreniz başlayacaktır."

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`register:${ip}`, REGISTER_MAX_ATTEMPTS, REGISTER_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429 }
    )
  }

  // Accept both multipart/form-data (from the register form) and JSON.
  let raw: Record<string, unknown>
  try {
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      raw = (await request.json()) as Record<string, unknown>
    } else {
      const form = await request.formData()
      raw = Object.fromEntries(form.entries())
    }
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const normalized = {
    ...raw,
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
  }

  const parsed = registerSchema.safeParse(normalized)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Reject duplicate e-mail up front with a clear message (also enforced by the
  // User.email unique constraint inside the transaction below).
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." },
      { status: 409 }
    )
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)

    await prisma.$transaction(async (tx) => {
      const workshop = await tx.workshop.create({
        data: {
          name: data.workshopName,
          phone: data.phone,
          city: data.city,
          address: data.address,
          email: data.email,
          // Early-access: requires admin approval; trial starts on approval.
          approvalStatus: "pending",
          subscriptionStatus: "trialing",
          planTier: "pro",
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
          // The self-serve registrant is the workshop's first user → owner.
          role: "owner",
        },
      })
    })

    return NextResponse.json({ success: true, message: PENDING_MESSAGE })
  } catch (err) {
    // Unique-constraint race (duplicate e-mail) or any other failure.
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." },
        { status: 409 }
      )
    }
    console.error("[register] failed:", err)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
