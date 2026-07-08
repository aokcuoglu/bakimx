/**
 * TAMI sanal POS (Garanti BBVA) istek/yanıt tipleri.
 * Alan adları dev.tami.com.tr dokümanlarından doğrulanmıştır (bkz. task raporu).
 */

// Tip-only import: runtime'da izi kalmaz, request-builder.ts'nin bu dosyadan TamiCard
// tip-only import'uyla oluşturduğu döngü zararsızdır (her iki yönde de `import type`).
import type { buildTamiPaymentBody } from "./request-builder"

export type TamiEnvName = "sandbox" | "production"

export type TamiPaymentChannel = "WEB" | "MOBILE" | "MOBILE_WEB"

/**
 * Kart bilgileri — SADECE bu tip loglardan/hata mesajlarından uzak tutulur.
 * `sanitizeForLog` bu alanı taşıyan üst nesnenin "card" anahtarını redakte eder.
 */
export interface TamiCard {
  number: string
  holderName: string
  expireMonth: number
  expireYear: number
  cvv: string
}

export interface TamiCardSummary {
  binNumber: string
  maskedNumber: string
  cardBrand: string
  cardOrganization: string
  cardType: string
}

/**
 * `/payment/auth` (ve `/payment/pre-auth`) isteği (securityHash imzalanmadan önceki hali).
 * Elle yazılmış bir arayüz DEĞİL — canlı sandbox'ta doğrulanan gerçek gövde şeklini üreten
 * `buildTamiPaymentBody`'nin dönüş tipinden türetilir, böylece istek tipi ile fiili wire
 * şeması birbirinden asla sapmaz. Bkz. request-builder.ts.
 */
export type TamiPaymentBody = ReturnType<typeof buildTamiPaymentBody>

export interface TamiAuth3dsResponse {
  success: boolean
  systemTime: string
  correlationId: string
  orderId: string
  amount?: number
  currency?: string
  installmentCount?: number
  card?: TamiCardSummary
  /** Base64 kodlanmış 3DS challenge HTML'i — decode etmek/render etmek route'un işi. */
  threeDSHtmlContent?: string
  securityHash?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface TamiComplete3dsResponse {
  success: boolean
  systemTime: string
  correlationId: string
  orderId: string
  amount?: number
  currency?: string
  installmentCount?: number
  bankAuthCode?: string
  bankReferenceNumber?: string
  card?: TamiCardSummary
  securityHash?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface TamiCancelInput {
  orderId: string
  reason?: string
}

export interface TamiRefundInput {
  orderId: string
  amount: number
  reason?: string
}

/** `/payment/reverse` yanıtı — iptal (tam) ve iade (kısmi) için ortak şekil. */
export interface TamiReverseResponse {
  success: boolean
  amount?: number
  currency?: string
  orderId: string
  systemTime: string
  correlationId: string
  securityHash?: string
  bankAuthCode?: string
  bankReferenceNumber?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface TamiQueryInput {
  orderId: string
  isTransactionDetail?: boolean
}

export interface TamiQueryResponse {
  success: boolean
  systemTime: string
  orderId: string
  amount?: number
  orderStatus?: string
  paymentStatus?: string
  card?: TamiCardSummary
  transactions?: unknown[]
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

/**
 * Bankanın 3DS doğrulaması sonrası bizim callbackUrl'imize POST ettiği alanlar.
 * hashedData formülünün girdisi olan alanları (`TamiCallbackHashFields`) da kapsar.
 */
export interface TamiCallbackHashFields {
  cardOrganization: string
  cardBrand: string
  cardType: string
  maskedNumber: string
  installmentCount: string | number
  currencyCode: string
  txnAmount: string | number
  orderId: string
  systemTime: string
  success: string | boolean
}

export interface TamiCallbackPayload extends TamiCallbackHashFields {
  mdStatus: string
  hashedData: string
}

export interface TamiClient {
  auth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse>
  /** `/payment/pre-auth` — kart doğrulama (1 TL ön provizyon). auth3ds ile aynı
   *  3DS başlatma sarmalayıcısı; başarıda iptal (cancel) ile bloke serbest bırakılır. */
  preAuth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse>
  complete3ds(orderId: string): Promise<TamiComplete3dsResponse>
  cancel(input: TamiCancelInput): Promise<TamiReverseResponse>
  refund(input: TamiRefundInput): Promise<TamiReverseResponse>
  queryTransaction(input: TamiQueryInput): Promise<TamiQueryResponse>
}
