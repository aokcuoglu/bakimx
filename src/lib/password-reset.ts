import { randomBytes, createHash } from "node:crypto"

/**
 * Password-reset token helpers.
 *
 * The raw token is sent only in the password-reset e-mail. We persist
 * `sha256(token)` (hex) as `PasswordReset.tokenHash`, so a database leak cannot
 * reproduce a usable reset link. Lookups hash the incoming token and match.
 */

export const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashResetToken(token) }
}

export function resetExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TTL_MS)
}

export function isResetExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now()
}

/**
 * Konsoldan (BAK-97) aynı kullanıcıya tekrar bağlantı göndermek için beklenecek
 * süre. Sayaç DB'deki son token'ın `createdAt`'idir, bellekteki `rateLimit`
 * değil: konsol birden çok ECS görevinde çalışır ve süreç-içi sayaç yeniden
 * başlatmada sıfırlanır.
 *
 * Pencere kullanıcının KENDİ talebini de kapsar — her yeni token öncekileri
 * geçersiz kılar, yani art arda gönderim kullanıcının elindeki taze bağlantıyı
 * öldürürdü.
 */
export const RESET_RESEND_COOLDOWN_MS = 5 * 60 * 1000 // 5 dk

/** Yeni gönderim için kalan süre (ms). 0 ise gönderilebilir. */
export function resendCooldownRemainingMs(
  lastSentAt: Date | null | undefined,
  now: Date = new Date()
): number {
  if (!lastSentAt) return 0
  return Math.max(0, lastSentAt.getTime() + RESET_RESEND_COOLDOWN_MS - now.getTime())
}

/** Kalan süreyi kullanıcıya gösterilecek metne çevirir ("2 dakika" / "40 saniye"). */
export function formatCooldownWait(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000)
  if (seconds < 60) return `${seconds} saniye`
  return `${Math.ceil(seconds / 60)} dakika`
}
