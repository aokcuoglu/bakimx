/**
 * Provider-neutral procurement types, shaped after the GetirBakım partner order
 * contract v2.0 (issue #751). v2.0 is not backwards compatible with the 1.0
 * pilot: quotes are multi-line, shipping is part of the quote, nothing is
 * reserved (no `RESERVATION_EXPIRED`) and there are no webhooks — the order is
 * followed with `GET /orders/:id`.
 */
export const PROCUREMENT_CONTRACT_VERSION = "2.0" as const

export const PROCUREMENT_STATUSES = [
  "REQUESTED", "CONFIRMED", "SHIPPED", "COMPLETED", "CANCELLED",
] as const

export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number]

/** Orders in these statuses never change again; polling stops. */
export const TERMINAL_PROCUREMENT_STATUSES: ReadonlySet<string> = new Set<ProcurementStatus>(["CANCELLED", "COMPLETED"])

export const CANCELLATION_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
export type CancellationRequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number]

export const PROCUREMENT_CANCELLED_BY = ["PARTNER", "GETIRBAKIM"] as const
export type ProcurementCancelledBy = (typeof PROCUREMENT_CANCELLED_BY)[number]

/** Contract limits (POST /order-quotes, POST /orders). */
export const MAX_PROCUREMENT_LINES = 20
export const MAX_PROCUREMENT_LINE_QUANTITY = 99

/** Goods totals plus the VAT-inclusive shipping fee: grossKurus = netKurus + vatKurus + shippingKurus. */
export interface ProcurementTotals {
  netKurus: number
  vatKurus: number
  shippingKurus: number
  grossKurus: number
}

export interface ProcurementPricedLine {
  selectedOfferId: string
  quantity: number
  /** Binding unit price before VAT. */
  unitNetKurus: number
  vatRateBps: number
  lineNetKurus: number
  lineVatKurus: number
  lineGrossKurus: number
}

export interface ProcurementOrderLine extends ProcurementPricedLine {
  partNo: string
  name: string
}

export interface ProcurementShippingAddress {
  recipientName: string
  phone: string
  email?: string | null
  province: string
  district: string
  addressLine: string
  postalCode?: string | null
}

export interface ProcurementShipment {
  carrier: string | null
  trackingNo: string | null
  trackingUrl: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

export interface ProcurementCancellationRequest {
  status: CancellationRequestStatus
  requestedAt: string
  decidedAt: string | null
}

export interface ProcurementOrder {
  contractVersion: typeof PROCUREMENT_CONTRACT_VERSION
  id: string
  number: number
  idempotencyKey: string
  status: ProcurementStatus
  paymentStatus: "ON_ACCOUNT"
  currency: string
  totals: ProcurementTotals
  lines: ProcurementOrderLine[]
  shippingAddress: ProcurementShippingAddress
  note: string
  shipment: ProcurementShipment | null
  cancelledBy: ProcurementCancelledBy | null
  cancelledAt: string | null
  cancellationRequest: ProcurementCancellationRequest | null
  createdAt: string
}

export interface ProcurementQuoteLineRequest {
  selectedOfferId: string
  quantity: number
}

export interface ProcurementQuote {
  contractVersion: typeof PROCUREMENT_CONTRACT_VERSION
  lines: ProcurementPricedLine[]
  totals: ProcurementTotals
  currency: string
  /** Binding for 15 minutes. */
  expiresAt: string
  confirmationToken: string
}

export interface CreateProcurementOrder {
  idempotencyKey: string
  confirmationToken: string
  /** Exactly the quoted lines; expectedUnitNetKurus = the quoted unitNetKurus. */
  lines: Array<{ selectedOfferId: string; quantity: number; expectedUnitNetKurus: number }>
  shippingAddress: ProcurementShippingAddress
  note?: string
}

export interface ProcurementCancellationResult {
  order: ProcurementOrder
  /** CANCELLED: cancelled at once (or already). REQUESTED: confirmed order, operations decide. */
  cancellation: "CANCELLED" | "REQUESTED"
}

/** Conflicts after which the user must look at a fresh quote and confirm again. */
export const RECONFIRMATION_REQUIRED_CODES = new Set([
  "PRICE_CHANGED", "QUOTE_CHANGED", "QUOTE_EXPIRED",
])

export function requiresProcurementReconfirmation(code: string): boolean {
  return RECONFIRMATION_REQUIRED_CODES.has(code)
}

/**
 * Whether a failed POST /orders certainly created nothing, so the local attempt
 * can be released for a new quote and a new Idempotency-Key. The contract asks
 * for exactly that on every order-creation 409 except IDEMPOTENCY_CONFLICT; a
 * 400 VALIDATION_ERROR or 401 is a rejection too, and so is 503
 * ORDER_INTAKE_PAUSED. Retryable (429/5xx/network)
 * and unreadable 2xx answers stay ambiguous and are reconciled by key instead.
 */
export function releasesProcurementAttempt(error: { code: string; status?: number; retryable: boolean }): boolean {
  // A paused intake is checked again when the order is created, so a 503
  // ORDER_INTAKE_PAUSED means no order exists for this key.
  if (error.code === "ORDER_INTAKE_PAUSED" && error.status === 503) return true
  if (error.retryable || error.status == null) return false
  return error.status >= 400 && error.status < 500 && error.code !== "IDEMPOTENCY_CONFLICT"
}

/** Turkish messages shown to the workshop for the contract's error codes. */
const PROCUREMENT_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "GetirBakım isteği kabul etmedi. Teslimat adresini ve adetleri kontrol edin.",
  UNAUTHORIZED: "GetirBakım sipariş bağlantısı yetkilendirilemedi. Yöneticinize bildirin.",
  ORDER_NOT_FOUND: "Sipariş GetirBakım'da bulunamadı.",
  OFFER_UNAVAILABLE: "Seçilen teklif artık satışta değil. Teklifler yenilendi; güncel bir teklif seçin.",
  QUANTITY_UNAVAILABLE: "İstenen adet bu tekliften sipariş edilemiyor. Adedi azaltın veya başka bir teklif seçin.",
  PRICE_CHANGED: "Fiyat veya kargo ücreti değişti. Güncel teklifi kontrol edip yeniden onaylayın.",
  QUOTE_EXPIRED: "Teklifin süresi doldu. Güncel teklifi kontrol edip yeniden onaylayın.",
  QUOTE_CHANGED: "Teklif değişti. Güncel teklifi kontrol edip yeniden onaylayın.",
  CREDIT_LIMIT_EXCEEDED: "GetirBakım cari hesap limitiniz bu sipariş için yetersiz. Açık siparişleriniz faturalanınca limit açılır.",
  IDEMPOTENCY_CONFLICT: "Bu satın alma isteği farklı bilgilerle daha önce gönderilmiş. Pencereyi kapatıp yeniden deneyin.",
  CANCELLATION_REJECTED: "İptal talebiniz GetirBakım tarafından reddedildi; sipariş gönderilecek. İade için GetirBakım ile görüşün.",
  ORDER_ALREADY_SHIPPED: "Sipariş kargoya verildi; iptal edilemez. İade için GetirBakım ile görüşün.",
  RATE_LIMITED: "GetirBakım'a çok sık istek gönderildi. Biraz sonra yeniden deneyin.",
  QUOTE_CONFIGURATION_UNAVAILABLE: "GetirBakım teklif servisi şu anda kullanılamıyor. Daha sonra yeniden deneyin.",
  ORDER_INTAKE_PAUSED: "GetirBakım bu hesap için yeni sipariş alımını geçici olarak durdurdu. Mevcut siparişleriniz etkilenmez; sipariş alımı yeniden açılınca tekrar deneyin.",
  ORDER_LIMIT_UNAVAILABLE: "GetirBakım cari hesap limitiniz tanımlı değil; sipariş verilemiyor. GetirBakım ile görüşün.",
  SUPPLIER_CHECK_UNAVAILABLE: "Tedarikçi kontrolü şu anda yapılamadı. Biraz sonra yeniden deneyin.",
  PROVIDER_UNAVAILABLE: "GetirBakım'a şu anda ulaşılamıyor. Biraz sonra yeniden deneyin.",
  INVALID_PROVIDER_RESPONSE: "GetirBakım'dan beklenmeyen bir yanıt geldi. Sipariş durumunu daha sonra kontrol edin.",
}

export function procurementErrorMessage(code: string, fallback = "GetirBakım isteği tamamlanamadı."): string {
  return PROCUREMENT_ERROR_MESSAGES[code] ?? fallback
}

export interface ProcurementProviderClient {
  readonly provider: string
  quoteOrder(lines: ProcurementQuoteLineRequest[]): Promise<ProcurementQuote>
  createOrder(input: CreateProcurementOrder): Promise<{ order: ProcurementOrder; replayed: boolean }>
  getOrder(id: string): Promise<ProcurementOrder>
  getOrderByIdempotencyKey(key: string): Promise<ProcurementOrder | null>
  cancelOrder(id: string): Promise<ProcurementCancellationResult>
}

export class ProcurementProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>,
  ) { super(message) }
}
