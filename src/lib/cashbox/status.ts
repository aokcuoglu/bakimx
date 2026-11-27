import { PAYMENT_STATUS } from "@/lib/constants"
import { subKurus } from "@/lib/money"
import type { StatusTone } from "@/lib/status-tone"

export type PaymentMethodKey = "cash" | "credit_card" | "bank_transfer" | "other"
export type PaymentStatusKey = "unpaid" | "partial" | "paid" | "overpaid" | "cancelled"
export type CollectionStatusKey = "completed" | "cancelled" | "refunded"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  bank_transfer: "Havale/EFT",
  other: "Diğer",
}

export const PAYMENT_METHOD_TONES: Record<PaymentMethodKey, StatusTone> = {
  cash: "success",
  credit_card: "primary",
  bank_transfer: "primary",
  other: "neutral",
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatusKey, string> = {
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
}

export const COLLECTION_STATUS_TONES: Record<CollectionStatusKey, StatusTone> = {
  completed: "success",
  cancelled: "destructive",
  refunded: "warning",
}

export const EXTENDED_PAYMENT_STATUS: Record<PaymentStatusKey, { label: string; tone: StatusTone }> = {
  unpaid: PAYMENT_STATUS.unpaid,
  partial: PAYMENT_STATUS.partial,
  paid: PAYMENT_STATUS.paid,
  overpaid: { label: "Fazla Ödeme", tone: "primary" },
  cancelled: PAYMENT_STATUS.cancelled,
}

/**
 * Payment status from authoritative kuruş integers. Integers compare exactly,
 * so the float epsilon from the lira era is no longer needed.
 */
export function computePaymentStatus(grandTotalKurus: number, paidKurus: number): PaymentStatusKey {
  if (paidKurus <= 0) return "unpaid"
  if (paidKurus >= grandTotalKurus && grandTotalKurus > 0) {
    return paidKurus === grandTotalKurus ? "paid" : "overpaid"
  }
  return "partial"
}

/** Remaining balance in kuruş, clamped at zero. */
export function computeRemainingAmount(grandTotalKurus: number, paidKurus: number): number {
  return Math.max(0, subKurus(grandTotalKurus, paidKurus))
}

/**
 * Bir iş emrinin tahsil edilen tutarı (kuruş) — ekranda TEK kaynak (#912).
 *
 * Asıl kaynak tamamlanmış tahsilatların toplamıdır (defter). `order.paidAmount`
 * yalnız bir önbellektir: `recalcOrderPayment` (src/lib/cashbox/recalc.ts)
 * yazar, o çağrılmadan değişen bir kayıtta defterden ayrışabilir. Eskiden
 * sayfa `order.paidAmount || defter` okuyordu: önbellek 0'dan büyükse defter
 * hiç görülmüyordu, iptal edilen son tahsilattan sonra bile eski tutar kalıyordu.
 *
 * Defter yüklendiyse (kasa özelliği açık) her zaman defter kazanır — defter 0
 * ve önbellek > 0 olsa da. Yüklenmediyse (Lite: tahsilat sorgusu atlanır)
 * önbellek okunur; boşsa 0.
 */
export function orderPaidKurus({
  ledgerLoaded,
  completedTotalKurus,
  cachedPaidKurus,
}: {
  /** Tamamlanmış tahsilatlar bu istekte sorgulandı mı. */
  ledgerLoaded: boolean
  /** Tamamlanmış tahsilatların toplamı (kuruş). */
  completedTotalKurus: number
  /** `ServiceOrder.paidAmount` önbelleği (kuruş). */
  cachedPaidKurus: number | null | undefined
}): number {
  if (ledgerLoaded) return completedTotalKurus
  return cachedPaidKurus ?? 0
}

/**
 * Ekranda gösterilen ödeme durumu (hap) — tutarlarla AYNI sayılardan (#912).
 *
 * Tahsil edilen tutar defterden okunurken hap `ServiceOrder.paymentStatus`
 * önbelleğinden okunursa ikisi ayrışabilir ("Kalan ₺0" yanında "Kısmi").
 * Defter yüklendiyse durum aynı Genel Toplam ve tahsil edilen tutardan
 * `computePaymentStatus` ile türetilir; bu, önbelleği yazan `recalcOrderPayment`
 * ile aynı kuraldır. Yüklenmediyse önbellek okunur.
 *
 * DİKKAT: tahsilat kilidi (`isCollectionLockedForOrder`) bunu KULLANMAZ —
 * sunucudaki kapı (`createCollectionAction`) önbelleği okur; ekrandaki düğme
 * sunucunun kararıyla aynı girdiden beslenmeli.
 */
export function orderDisplayPaymentStatus({
  ledgerLoaded,
  grandTotalKurus,
  paidKurus,
  cachedStatus,
}: {
  ledgerLoaded: boolean
  grandTotalKurus: number
  paidKurus: number
  /** `ServiceOrder.paymentStatus` önbelleği. */
  cachedStatus: string
}): string {
  return ledgerLoaded ? computePaymentStatus(grandTotalKurus, paidKurus) : cachedStatus
}
