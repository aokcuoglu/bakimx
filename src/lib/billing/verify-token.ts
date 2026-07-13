import { createHmac, timingSafeEqual } from "crypto"

/**
 * Kayıtta e-posta doğrulama akışının imzalı "verify" token'ı. `/register` bir
 * PENDING workshop yaratır ve bu token'ı üretir; token yalnızca hangi workshop'un
 * doğrulanacağını TAŞIR (ödeme sonucu ya da yetki DEĞİL — sonuç her zaman DB'den
 * okunur). Token'ı taşıyan herkes yalnız doğrulama linkini kullanabilir; workshop
 * pending değilse initiate route hiçbir şey yapmaz.
 *
 * Biçim: `workshopId.expEpochMs.base64url(HMAC-SHA256(secret, workshopId.expEpochMs))`
 * (cuid'lerde nokta yoktur → tam 3 parça). HMAC secret'i OTURUM KATMANIYLA AYNI
 * env'den gelir (SESSION_SECRET — bkz. src/lib/session.ts). readVerifyToken
 * timingSafeEqual + exp kontrolü yapar; kurcalanmış/süresi geçmiş/bozuk → null.
 */

// E-posta doğrulama linki ömrü — 48 saatlik purge penceresiyle hizalı
// (bkz. lifecycle.ts PURGE_STALE_MS). Süresi dolan link /login?verify=invalid'e düşer.
const TTL_MS = 48 * 60 * 60 * 1000

/** SESSION_SECRET — oturum katmanının (src/lib/session.ts getSessionSecret) kullandığı
 *  AYNI env değişkeni ve AYNI dev-fallback semantiği. Prod'da eksikse throw. */
function verifyTokenSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.trim() !== "") return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET ortam değişkeni production ortamında zorunludur (kart doğrulama token imzası)."
    )
  }
  // Dev/test fallback — session.ts ile birebir aynı değer (tokenlar uyumlu kalsın).
  return "complex_password_at_least_32_characters_long_for_dev"
}

function sign(payload: string): string {
  return createHmac("sha256", verifyTokenSecret()).update(payload).digest("base64url")
}

/** Pending bir workshop için 48 saat geçerli imzalı doğrulama token'ı üretir. */
export function createVerifyToken(workshopId: string): string {
  const exp = Date.now() + TTL_MS
  const payload = `${workshopId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** Token geçerliyse workshopId'yi, aksi halde (kurcalama/süre/biçim) null döndürür. */
export function readVerifyToken(token: string): string | null {
  if (typeof token !== "string" || token === "") return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [workshopId, expStr, sig] = parts
  if (!workshopId || !expStr || !sig) return null

  const expected = sign(`${workshopId}.${expStr}`)
  const provided = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  // timingSafeEqual eşit uzunluk ister; farklıysa erken (sabit-zaman-dışı ama zararsız) çıkış.
  if (provided.length !== expectedBuf.length) return null
  if (!timingSafeEqual(provided, expectedBuf)) return null

  const exp = Number(expStr)
  if (!Number.isFinite(exp) || Date.now() > exp) return null
  return workshopId
}
