import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { registerSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getAdminEmails } from "@/lib/admin"
import { newApplicationAdminEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { canResumeVerification } from "@/lib/billing/verify-resume"
import { sendVerifyEmail } from "@/lib/billing/verify-email"

/**
 * Self-serve workshop registration (email-verification gated trial).
 *
 * Creates a new isolated Workshop + its first owner User in `pending` status
 * with NO trial started yet — the 7-day trial begins only after the owner
 * verifies their e-mail address (see activateVerifiedWorkshop). The welcome
 * e-mail also moved there (single-send). This route sends a verification
 * e-mail via `sendVerifyEmail` and returns `{ ok: true }`; no token is
 * returned in the response and no session is created here.
 */

const REGISTER_MAX_ATTEMPTS = 5
const REGISTER_WINDOW_MS = 10 * 60_000 // 10 minutes

const GENERIC_ERROR = "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin."
const EMAIL_IN_USE_ERROR = "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin."
const EMAIL_SEND_ERROR = "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin."

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

  // Existing e-mail: either an AUTH-BOUNDED resume of an interrupted registration
  // or the ordinary "e-posta kullanımda" rejection. RESUME only when the supplied
  // password verifies against the stored hash (same bcrypt.compare login uses) AND
  // the workshop is still pending with no trial started — otherwise the generic
  // rejection (wrong password is indistinguishable from a non-resumable account,
  // so there is no account-takeover path).
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: {
      password: true,
      workshop: { select: { id: true, approvalStatus: true, trialStartedAt: true } },
    },
  })
  if (existing) {
    const passwordValid = await bcrypt.compare(data.password, existing.password)
    if (
      canResumeVerification({
        passwordValid,
        approvalStatus: existing.workshop.approvalStatus,
        trialStartedAt: existing.workshop.trialStartedAt,
      })
    ) {
      const sent = await sendVerifyEmail(existing.workshop.id)
      if (!sent.ok) {
        return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
      }
      return NextResponse.json({ ok: true, resumed: true })
    }
    return NextResponse.json({ error: EMAIL_IN_USE_ERROR }, { status: 409 })
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)

    const workshop = await prisma.$transaction(async (tx) => {
      const ws = await tx.workshop.create({
        data: {
          name: data.workshopName,
          phone: data.phone,
          city: data.city,
          address: data.address,
          email: data.email,
          // Approval-gated trial: pending until the e-mail is verified. The trial
          // (trialStartedAt/EndsAt) starts in activateVerifiedWorkshop, not here.
          approvalStatus: "pending",
          subscriptionStatus: "trialing",
          trialStartedAt: null,
          trialEndsAt: null,
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
          workshopId: ws.id,
          // The self-serve registrant is the workshop's first user → owner.
          role: "owner",
        },
      })
      return ws
    })

    // Doğrulama e-postası — akışın kilit taşı. Workshop+User zaten commit edildi;
    // gönderim başarısızsa 500 döner ve kullanıcı aynı bilgilerle tekrar POST edince
    // resume yolu (pending + trialsız) linki yeniden yollar (veri kaybı yok).
    const sent = await sendVerifyEmail(workshop.id)

    // Best-effort admin bildirimi — hata kayıt sonucunu etkilemez. Karşılama
    // e-postası BURADA DEĞİL, e-posta doğrulaması başarıya ulaştığında
    // activateVerifiedWorkshop içinde tek sefer gönderilir (çifte gönderim yok).
    try {
      const adminMail = newApplicationAdminEmail({
        workshopName: data.workshopName,
        ownerName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        phone: data.phone,
        city: data.city,
      })
      await Promise.allSettled(
        getAdminEmails().map((to) =>
          sendSystemEmail({
            to,
            subject: adminMail.subject,
            html: adminMail.html,
            workshopId: workshop.id,
            templateKey: "new_application_admin",
            // Alıcı platform yöneticisi — kayıt yeni kiracının workshopId'siyle
            // tutulur ama onun ekranında GÖRÜNMEZ (issue #194).
            audience: "internal",
          }),
        ),
      )
    } catch (mailErr) {
      console.error("[register] notification failed:", mailErr instanceof Error ? mailErr.message : mailErr)
    }

    if (!sent.ok) {
      return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Unique-constraint race (duplicate e-mail) or any other failure.
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json({ error: EMAIL_IN_USE_ERROR }, { status: 409 })
    }
    console.error("[register] failed:", err)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
