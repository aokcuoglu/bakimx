import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { forgotPasswordSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { passwordResetEmail } from "@/lib/emails/system-emails"
import { generateResetToken, resetExpiry } from "@/lib/password-reset"
import { canReceivePasswordReset } from "@/lib/user-identity"

const GENERIC_MESSAGE =
  "Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi."

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)

  const ipLimit = rateLimit(`pwreset-ip:${ip}`, 5, 15 * 60 * 1000)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const rawEmail = (body as { email?: unknown })?.email
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : ""

  const parsed = forgotPasswordSchema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz e-posta." },
      { status: 400 },
    )
  }

  // E-posta bazlı limit aşıldıysa da generic yanıt (enumeration sızıntısı yok)
  const emailLimit = rateLimit(`pwreset-email:${parsed.data.email}`, 3, 15 * 60 * 1000)
  if (emailLimit.allowed) {
    try {
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
      // E-postasız kullanıcı bu akışta HİÇ eşleşmemeli (BAK-40): şifresini
      // atölye sahibi ekip panelinden sıfırlar. `findUnique({ email })` dolu bir
      // e-postayla arıyor, yani zaten eşleşemez — kapı yine de açıkça duruyor ki
      // sorgu bir gün gevşerse token e-postasız hesaba yazılmasın.
      if (canReceivePasswordReset(user) && user?.email) {
        await prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        })

        const { token, tokenHash } = generateResetToken()
        await prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt: resetExpiry() },
        })

        const resetUrl = `${appUrl()}/reset-password/${token}`
        const mail = passwordResetEmail({ resetUrl, firstName: user.firstName ?? undefined })
        void sendSystemEmail({
          to: user.email,
          subject: mail.subject,
          html: mail.html,
          workshopId: user.workshopId,
          templateKey: "password_reset",
          audience: "workshop",
        }).catch(() => {})
      }
    } catch {
      // swallow: fall through to the generic response (no existence oracle on DB errors)
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
}
