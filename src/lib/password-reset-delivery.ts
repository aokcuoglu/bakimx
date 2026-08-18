import { prisma } from "@/lib/db"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { passwordResetEmail } from "@/lib/emails/system-emails"
import { generateResetToken, resetExpiry } from "@/lib/password-reset"

/**
 * Şifre sıfırlama bağlantısının TEK üretim yolu.
 *
 * Hem herkese açık form (`/api/auth/forgot-password`) hem de konsoldaki destek
 * aksiyonu (BAK-97) buradan geçer. İki ayrı akış olsaydı, token geçersizleme
 * ("önceki bağlantılar ölür") ya da e-posta şablonu birinde değişip diğerinde
 * kalırdı.
 *
 * Ham token buradan DIŞARI ÇIKMAZ: yalnız e-postanın gövdesine girer. Çağıran
 * bağlantıyı asla göremez — ele geçirilmiş bir yönetici hesabı tek tıkla kiracı
 * hesabına giremesin diye (BAK-97 kabul kriteri).
 */

export interface PasswordResetRecipient {
  id: string
  email: string
  firstName: string | null
  workshopId: string
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

/**
 * Önceki kullanılmamış token'ları geçersizler, yenisini yazar ve e-postayı gönderir.
 *
 * `awaitDelivery` — herkese açık formda `false`: yanıt sağlayıcıyı beklemez, aksi
 * hâlde yanıt süresi "bu e-posta kayıtlı mı" sorusunu sızdıran bir kehanet olur.
 * Konsolda `true`: destek personeli gönderimin gerçekten başarılı olduğunu görmeli.
 */
export async function issuePasswordReset(
  user: PasswordResetRecipient,
  options: { awaitDelivery?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const { token, tokenHash } = generateResetToken()
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: resetExpiry() },
  })

  const mail = passwordResetEmail({
    resetUrl: `${appUrl()}/reset-password/${token}`,
    firstName: user.firstName ?? undefined,
  })
  const deliver = () =>
    sendSystemEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      workshopId: user.workshopId,
      templateKey: "password_reset",
      audience: "workshop",
    })

  if (!options.awaitDelivery) {
    void deliver().catch(() => {})
    return { ok: true }
  }
  return deliver()
}
