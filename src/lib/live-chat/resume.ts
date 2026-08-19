import { createHash, randomBytes } from "node:crypto"

/**
 * "Sohbete geri dön" bağlantısının anahtarı (BAK-99).
 *
 * NEDEN görüşmenin `publicToken`'ı e-postaya konmuyor: o token görüşmenin kalıcı
 * ve SÜRESİZ anahtarıdır. Düz metin olarak e-postaya girerse, o kutuya erişen
 * (ya da iletilen e-postayı gören) herkes görüşmeyi süresiz açar ve iptal
 * etmenin bir yolu kalmaz. Burada üretilen anahtar görüşmeden ayrıdır, süresi
 * vardır ve iptal edilebilir; `PasswordResetToken` deseninin aynısı.
 *
 * Bu dosya BİLEREK saf: prisma/e-posta bağımlılığı yok, süre ve geçerlilik
 * kararları birim testinden geçer. DB'ye dokunan taraf `server.ts`te.
 */

/** Bağlantının ömrü. Kararı issue'da: 7 gün (BAK-99, Mika 18 Ağustos). */
export const RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashResumeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateResumeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashResumeToken(token) }
}

export function resumeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESUME_TTL_MS)
}

/**
 * URL'den gelen değerin şekil kontrolü. Amaç doğrulama değil, uydurma/çok uzun
 * bir segmentin DB'ye kadar gitmesini ucuza kesmek — `findConversationByToken`
 * ile aynı yaklaşım.
 */
export function isWellFormedResumeToken(token: string | null | undefined): token is string {
  if (!token) return false
  return token.length >= 32 && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token)
}

export interface ResumeTokenState {
  expiresAt: Date
  revokedAt: Date | null
}

/** Kayıt hâlâ sohbeti açabilir mi? Süresi dolmuş ya da iptal edilmişse hayır. */
export function isResumeTokenUsable(record: ResumeTokenState, now: Date = new Date()): boolean {
  if (record.revokedAt) return false
  return record.expiresAt.getTime() > now.getTime()
}
