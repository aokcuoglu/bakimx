import { prisma } from "@/lib/db"
import { createVerifyToken } from "@/lib/billing/verify-token"
import { verifyEmailEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"

/**
 * Kayıt e-posta doğrulama linkini owner'a yollar. Token stateless + imzalı
 * (verify-token); yalnız workshopId taşır. Recipient owner user (yoksa workshop
 * e-postası). Best-effort DEĞİL: çağıran { ok } sonucunu kullanır — link olmadan
 * kullanıcı ilerleyemez. sendSystemEmail asla throw etmez (CommunicationLog yazar).
 */
export async function sendVerifyEmail(workshopId: string): Promise<{ ok: boolean }> {
  const [workshop, owner] = await Promise.all([
    prisma.workshop.findUnique({ where: { id: workshopId }, select: { name: true, email: true } }),
    prisma.user.findFirst({
      where: { workshopId, role: "owner" },
      orderBy: { createdAt: "asc" },
      select: { email: true, firstName: true },
    }),
  ])
  const to = owner?.email || workshop?.email
  if (!workshop || !to) return { ok: false }

  const token = createVerifyToken(workshopId)
  const verifyUrl = buildVerifyUrl(process.env.APP_URL || "http://localhost:3000", token)
  const built = verifyEmailEmail({ verifyUrl, firstName: owner?.firstName || "" })

  const res = await sendSystemEmail({
    to,
    subject: built.subject,
    html: built.html,
    workshopId,
    // Statik key: resend akışında birden çok gönderime izin ver (sendSystemEmail dedup ETMEZ).
    templateKey: "verify_email",
  })
  return { ok: res.ok }
}

/** Doğrulama linki: `${appUrl}/api/auth/verify-email?token=<token>` (slash-güvenli). */
export function buildVerifyUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "")
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}
