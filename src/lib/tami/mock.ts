import { computeCallbackHash } from "./hash"
import type {
  TamiAuth3dsResponse,
  TamiCallbackHashFields,
  TamiClient,
  TamiComplete3dsResponse,
  TamiPaymentBody,
  TamiQueryResponse,
  TamiReverseResponse,
} from "./types"

/** Mock istemcinin callback HMAC'ini imzaladığı sabit anahtar — gerçek TAMI secretKey'i DEĞİLDİR. */
export const MOCK_SECRET_KEY = "mock-secret"

function maskCardNumber(number: string): string {
  const clean = number.replace(/\s/g, "")
  const visibleStart = clean.slice(0, 6)
  const visibleEnd = clean.slice(-4)
  const stars = "*".repeat(Math.max(clean.length - visibleStart.length - visibleEnd.length, 0))
  return `${visibleStart}${stars}${visibleEnd}`
}

/**
 * Callback'in `maskedNumber` alanı — canlı yakalanan gerçek biçim: ilk 8 hane + sabit
 * 4 yıldız + son 2 hane (ör. "54066975****73"), auth yanıtındaki kart özetinin
 * (6+4 görünür) maskeleme deseninden FARKLIDIR — yalnız callback alanları için kullanılır.
 */
function maskCardNumberForCallback(number: string): string {
  const clean = number.replace(/\s/g, "")
  return `${clean.slice(0, 8)}****${clean.slice(-2)}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function hiddenInputsHtml(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([name, value]) => `      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join("\n")
}

/** Callback'in `hashedData` girdisinin hangi alanlardan oluştuğunu belirten bilgi alanı
 *  (canlı yakalanan callback'te de mevcut) — hash HESABINI etkilemez, yalnız bilgi taşır. */
const HASH_PARAMS_INFO =
  "cardOrganization+cardBrand+cardType+maskedNumber+installmentCount+currencyCode+txnAmount+orderId+systemTime+success"

function buildCallbackFields(
  input: TamiPaymentBody,
  mdStatus: "1" | "0",
  success: "true" | "false"
): Record<string, string> {
  const fields: TamiCallbackHashFields = {
    cardOrganization: "VISA",
    cardBrand: "BONUS",
    cardType: "CREDIT",
    maskedNumber: maskCardNumberForCallback(input.card.number),
    installmentCount: String(input.installmentCount),
    currencyCode: input.currency,
    // Canlı yakalanan wire formatı: "1", "1299.5" — .toFixed(2) DEĞİL (bkz. callback-capture.json).
    txnAmount: String(input.amount),
    orderId: input.orderId,
    systemTime: new Date().toISOString(),
    success,
  }
  const hashedData = computeCallbackHash(fields, MOCK_SECRET_KEY)

  // Tüm alanlar zaten string (yukarıda String()/literal ile üretildi) —
  // hiddenInputsHtml'in Record<string, string> beklentisiyle güvenle eşleşir.
  return {
    ...(fields as unknown as Record<string, string>),
    mdStatus,
    hashedData,
    hashParams: HASH_PARAMS_INFO,
    mdErrorMessage: "",
    callbackStatus: "",
  }
}

function renderMockThreeDsHtml(input: TamiPaymentBody): string {
  const successFields = buildCallbackFields(input, "1", "true")
  const failFields = buildCallbackFields(input, "0", "false")
  const callbackUrl = input.callbackUrl ?? ""

  return `<!doctype html>
<html lang="tr">
  <body>
    <h1>TAMI Mock 3D Secure</h1>
    <p>Sipariş: ${escapeHtml(input.orderId)}</p>
    <form method="post" action="${escapeHtml(callbackUrl)}" data-mock-outcome="success">
${hiddenInputsHtml(successFields)}
      <button type="submit">Ödemeyi Onayla</button>
    </form>
    <form method="post" action="${escapeHtml(callbackUrl)}" data-mock-outcome="failure">
${hiddenInputsHtml(failFields)}
      <button type="submit">Başarısız Dene</button>
    </form>
  </body>
</html>`
}

/**
 * Mock TAMI istemcisi — sandbox kimlik bilgileri yokken kullanılır (bkz. index.ts factory).
 * auth3ds, gerçek bankanın callbackUrl'e göndereceği alanlarla (hashedData dahil, GERÇEK
 * HMAC ile hesaplanmış) sahte bir 3DS formu üretir; böylece callback doğrulaması mock'ta da
 * uçtan uca çalışır. İki buton: "Ödemeyi Onayla" (mdStatus=1/success=true) ve
 * "Başarısız Dene" (mdStatus=0/success=false).
 */
function mockAuthResponse(input: TamiPaymentBody): TamiAuth3dsResponse {
  const html = renderMockThreeDsHtml(input)
  const threeDSHtmlContent = Buffer.from(html, "utf8").toString("base64")

  return {
    success: true,
    systemTime: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    installmentCount: input.installmentCount,
    card: {
      binNumber: input.card.number.replace(/\s/g, "").slice(0, 8),
      maskedNumber: maskCardNumber(input.card.number),
      cardBrand: "BONUS",
      cardOrganization: "VISA",
      cardType: "CREDIT",
    },
    threeDSHtmlContent,
    securityHash: "mock-security-hash",
  }
}

export function createMockTamiClient(): TamiClient {
  return {
    async auth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse> {
      return mockAuthResponse(input)
    },

    async preAuth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse> {
      // Mock: ön provizyon 3DS'i auth3ds ile birebir aynı sahte akışı üretir
      // (amount 1, aynı callback formları) — doğrulama akışı mock'ta da uçtan uca çalışır.
      return mockAuthResponse(input)
    },

    async complete3ds(orderId: string): Promise<TamiComplete3dsResponse> {
      return {
        success: true,
        systemTime: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        orderId,
        bankAuthCode: "MOCKAUTH",
        bankReferenceNumber: "MOCKREF",
        securityHash: "mock-security-hash",
      }
    },

    async cancel(input) {
      return {
        success: true,
        orderId: input.orderId,
        systemTime: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        securityHash: "mock-security-hash",
        bankAuthCode: "MOCKAUTH",
        bankReferenceNumber: "MOCKREF",
      } satisfies TamiReverseResponse
    },

    async refund(input) {
      return {
        success: true,
        orderId: input.orderId,
        amount: input.amount,
        systemTime: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        securityHash: "mock-security-hash",
        bankAuthCode: "MOCKAUTH",
        bankReferenceNumber: "MOCKREF",
      } satisfies TamiReverseResponse
    },

    async queryTransaction(input) {
      return {
        success: true,
        systemTime: new Date().toISOString(),
        orderId: input.orderId,
        orderStatus: "AUTH",
        paymentStatus: "SUCCESS",
      } satisfies TamiQueryResponse
    },
  }
}
