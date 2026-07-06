import { expect, test } from "bun:test"
import { compactVerify } from "jose"
import { buildAuthToken, computeCallbackHash, signSecurityHash, verifyCallbackHash } from "./hash"
import type { TamiCallbackHashFields } from "./types"

// Bilinen doğrulama vektörü — HMAC/callback alanları.
const KNOWN_CALLBACK_FIELDS: TamiCallbackHashFields = {
  cardOrganization: "VISA",
  cardBrand: "BONUS",
  cardType: "CREDIT",
  maskedNumber: "540669******1173",
  installmentCount: "1",
  currencyCode: "TRY",
  txnAmount: "100.00",
  orderId: "ORDER123",
  systemTime: "2026-07-06 12:00:00",
  success: "true",
}
// Yukarıdaki alanlar için beklenen hash, formül üzerinden BİR KEZ node crypto ile elle
// hesaplandı (secretKey="mock-secret"): burada sabit string olarak gömülü, testte
// yeniden hesaplanmıyor (totoloji değil).
const KNOWN_CALLBACK_HASH = "Wa7HxQZE24OPvpeOxqKhJRqdmy03h3thQ3C0wMwbwv8="

test("buildAuthToken: bilinen merchant/terminal/secretKey için sabit Base64(SHA-256) üretir", () => {
  // Değer, dev.tami.com.tr/tami-satis-islemi sayfasındaki sandbox örnek kimlik bilgileriyle
  // ("77006950", "84006953", "0edad05a-7ea7-40f1-a80c-d600121ca51b") BİR KEZ node crypto ile
  // elle hesaplandı ve burada sabit olarak gömüldü.
  const token = buildAuthToken({
    merchantNumber: "77006950",
    terminalNumber: "84006953",
    secretKey: "0edad05a-7ea7-40f1-a80c-d600121ca51b",
  })

  expect(token).toBe("77006950:84006953:Y1b81CLYkxvCvw/LhNwS+5c+cSgVGBH2bcAEg1Ik93Y=")
})

test("buildAuthToken: farklı secretKey farklı hash üretir (yanlış-pozitif koruması)", () => {
  const token = buildAuthToken({
    merchantNumber: "77006950",
    terminalNumber: "84006953",
    secretKey: "farkli-bir-secret",
  })

  expect(token).not.toBe("77006950:84006953:Y1b81CLYkxvCvw/LhNwS+5c+cSgVGBH2bcAEg1Ik93Y=")
  expect(token.startsWith("77006950:84006953:")).toBe(true)
})

test("signSecurityHash: jose compactVerify ile doğrulanabilen HS512 JWS üretir; header'da alg=HS512 ve doğru kid var, payload securityHash alanı İÇERMEZ", async () => {
  const cfg = { jwkKid: "test-kid-1", jwkKey: "uTFK37C1qQddme6Qjyd1KkcrvdJbHfSAHG9m1zmDhSc" }
  const body = { orderId: "ORDER-1", amount: 100.5, currency: "TRY", securityHash: "sizzling-should-be-stripped" }

  const jws = await signSecurityHash(body, cfg)

  const key = { kty: "oct" as const, kid: cfg.jwkKid, k: cfg.jwkKey, alg: "HS512" }
  const { protectedHeader, payload } = await compactVerify(jws, key)

  expect(protectedHeader.alg).toBe("HS512")
  expect(protectedHeader.kid).toBe("test-kid-1")

  const decoded = JSON.parse(new TextDecoder().decode(payload))
  expect(decoded.orderId).toBe("ORDER-1")
  expect(decoded.amount).toBe(100.5)
  expect(decoded.securityHash).toBeUndefined()
  expect("securityHash" in decoded).toBe(false)
})

test("signSecurityHash: yanlış anahtarla doğrulama başarısız olur", async () => {
  const cfg = { jwkKid: "test-kid-1", jwkKey: "uTFK37C1qQddme6Qjyd1KkcrvdJbHfSAHG9m1zmDhSc" }
  const body = { orderId: "ORDER-1" }

  const jws = await signSecurityHash(body, cfg)

  const wrongKey = { kty: "oct" as const, kid: cfg.jwkKid, k: "yPXjSAOu5abG3Am_1dGZ2mFZ8FZ0oNQz0uY5nQvcT2E", alg: "HS512" }

  await expect(compactVerify(jws, wrongKey)).rejects.toThrow()
})

test("computeCallbackHash: bilinen alan seti + mock-secret için sabit test vektörünü üretir", () => {
  const hash = computeCallbackHash(KNOWN_CALLBACK_FIELDS, "mock-secret")

  expect(hash).toBe(KNOWN_CALLBACK_HASH)
})

test("verifyCallbackHash: doğru hashedData → true", () => {
  const payload = { ...KNOWN_CALLBACK_FIELDS, hashedData: KNOWN_CALLBACK_HASH }

  expect(verifyCallbackHash(payload, { secretKey: "mock-secret" })).toBe(true)
})

test("verifyCallbackHash: hashedData'da tek karakter oynanmış → false", () => {
  const lastChar = KNOWN_CALLBACK_HASH.at(-1)
  const flipped = lastChar === "8" ? "9" : "8"
  const tampered = `${KNOWN_CALLBACK_HASH.slice(0, -1)}${flipped}`
  const payload = { ...KNOWN_CALLBACK_FIELDS, hashedData: tampered }

  expect(verifyCallbackHash(payload, { secretKey: "mock-secret" })).toBe(false)
})

test("verifyCallbackHash: yanlış secretKey ile de false döner", () => {
  const payload = { ...KNOWN_CALLBACK_FIELDS, hashedData: KNOWN_CALLBACK_HASH }

  expect(verifyCallbackHash(payload, { secretKey: "wrong-secret" })).toBe(false)
})
