import { PAYMENT_STATUS } from "@/lib/constants"
import { subKurus } from "@/lib/money"

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
  cash: "bg-success/10 text-foreground border-success/20",
  credit_card: "bg-primary/10 text-foreground border-primary/20",
  bank_transfer: "bg-primary/10 text-foreground border-primary/20",
  other: "bg-muted text-foreground border-border",
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatusKey, string> = {
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
}

export const COLLECTION_STATUS_COLORS: Record<CollectionStatusKey, string> = {
  completed: "bg-success/10 text-foreground border-success/20",
  cancelled: "bg-destructive/10 text-foreground border-destructive/20",
  refunded: "bg-warning/10 text-foreground border-warning/20",
}

export const EXTENDED_PAYMENT_STATUS: Record<PaymentStatusKey, { label: string; color: string }> = {
  unpaid: PAYMENT_STATUS.unpaid,
  partial: PAYMENT_STATUS.partial,
  paid: PAYMENT_STATUS.paid,
  overpaid: { label: "Fazla Ödeme", color: "bg-primary/10 text-foreground border-primary/20" },
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
