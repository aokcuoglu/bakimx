import { createHash, createHmac, timingSafeEqual } from "crypto"
import { CompactSign } from "jose"
import type { TamiCallbackHashFields } from "./types"

/**
 * `PG-Auth-Token` header'ının hash kısmı: Base64(SHA-256(merchantNumber + terminalNumber + secretKey)).
 * Kaynak: dev.tami.com.tr/tami-satis-islemi + tami-sanal-pos-security-hash-hesaplama.
 */
export function buildAuthToken(cfg: { merchantNumber: string; terminalNumber: string; secretKey: string }): string {
  const raw = `${cfg.merchantNumber}${cfg.terminalNumber}${cfg.secretKey}`
  const hash = createHash("sha256").update(raw, "utf8").digest("base64")
  return `${cfg.merchantNumber}:${cfg.terminalNumber}:${hash}`
}

/**
 * Body'nin (securityHash HARİÇ) HS512 JWS (JWT compact) imzası. TAMI, gövde alanlarını
 * kendi tarafında JWK ile doğrular; imza kendi payload'unu taşıdığı için gövde alan
 * sırasına bağımlı değildir. Kaynak: dev.tami.com.tr/tami-sanal-pos-security-hash-hesaplama.
 */
export async function signSecurityHash(
  body: Record<string, unknown>,
  cfg: { jwkKid: string; jwkKey: string }
): Promise<string> {
  const { securityHash: _omit, ...rest } = body
  const payloadBytes = new TextEncoder().encode(JSON.stringify(rest))
  const jwk = { kty: "oct" as const, kid: cfg.jwkKid, k: cfg.jwkKey, alg: "HS512" }

  return new CompactSign(payloadBytes).setProtectedHeader({ alg: "HS512", kid: cfg.jwkKid }).sign(jwk)
}

/**
 * Banka callback'inin `hashedData` alanı için girdi birleşimi (sıra doküman sayfasından
 * teyit edildi — dev.tami.com.tr/tami-satis-islemi-3dli):
 * cardOrganization + cardBrand + cardType + maskedNumber + installmentCount + currencyCode
 * + txnAmount + orderId + systemTime + success, HMAC-SHA256(secretKey), Base64.
 *
 * NOT: Doküman formülü "currency"/"originalAmount"/"status" gibi genel adlar kullanıyor;
 * gerçek callback payload alan adları (currencyCode, txnAmount, success) buraya eşlendi —
 * bu eşleme sandbox'ta canlı doğrulanmadı, raporda ayrıca not edildi.
 */
export function computeCallbackHash(fields: TamiCallbackHashFields, secretKey: string): string {
  const data =
    String(fields.cardOrganization) +
    String(fields.cardBrand) +
    String(fields.cardType) +
    String(fields.maskedNumber) +
    String(fields.installmentCount) +
    String(fields.currencyCode) +
    String(fields.txnAmount) +
    String(fields.orderId) +
    String(fields.systemTime) +
    String(fields.success)

  return createHmac("sha256", secretKey).update(data, "utf8").digest("base64")
}

/** Callback'in hashedData'sını sabit-zamanlı karşılaştırma ile doğrular. */
export function verifyCallbackHash(
  payload: TamiCallbackHashFields & { hashedData: string },
  cfg: { secretKey: string }
): boolean {
  const expected = computeCallbackHash(payload, cfg.secretKey)
  const expectedBuf = Buffer.from(expected, "utf8")
  const actualBuf = Buffer.from(payload.hashedData ?? "", "utf8")

  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}
