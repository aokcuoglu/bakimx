import type { PaymentPillTone } from "./payment-pill"

/** Parça talebi durumu → hapın tonu. Bilinmeyen durum nötr. */
export function partsRequestPillTone(status: string): PaymentPillTone {
  switch (status) {
    case "requested":
      return "warning"
    case "prepared":
      return "info"
    case "delivered":
      return "success"
    case "cancelled":
      return "destructive"
    default:
      return "neutral"
  }
}
