import { PAYMENT_STATUS } from "@/lib/constants"

export type PaymentMethodKey = "cash" | "credit_card" | "bank_transfer" | "other"
export type PaymentStatusKey = "unpaid" | "partial" | "paid" | "overpaid" | "cancelled"
export type CollectionStatusKey = "completed" | "cancelled" | "refunded"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  bank_transfer: "Havale/EFT",
  other: "Diğer",
}

export const PAYMENT_METHOD_COLORS: Record<PaymentMethodKey, string> = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  credit_card: "bg-blue-50 text-blue-700 border-blue-200",
  bank_transfer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatusKey, string> = {
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
}

export const COLLECTION_STATUS_COLORS: Record<CollectionStatusKey, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-amber-50 text-amber-700 border-amber-200",
}

export const EXTENDED_PAYMENT_STATUS: Record<PaymentStatusKey, { label: string; color: string }> = {
  unpaid: PAYMENT_STATUS.unpaid,
  partial: PAYMENT_STATUS.partial,
  paid: PAYMENT_STATUS.paid,
  overpaid: { label: "Fazla Ödeme", color: "bg-sky-50 text-sky-700 border-sky-200" },
  cancelled: PAYMENT_STATUS.cancelled,
}

export function computePaymentStatus(grandTotal: number, paidAmount: number): PaymentStatusKey {
  if (paidAmount <= 0) return "unpaid"
  if (paidAmount >= grandTotal && grandTotal > 0) {
    return paidAmount > grandTotal ? "overpaid" : "paid"
  }
  return "partial"
}

export function computeRemainingAmount(grandTotal: number, paidAmount: number): number {
  return Math.max(0, grandTotal - paidAmount)
}