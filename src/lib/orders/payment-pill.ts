export type PaymentPillTone = "info" | "warning" | "success" | "destructive" | "neutral"

/** Ödeme durumu → başlık/panel hapının tonu. Bilinmeyen durum nötr. */
export function paymentPillTone(status: string): PaymentPillTone {
  switch (status) {
    case "unpaid":
      return "destructive"
    case "partial":
      return "warning"
    case "paid":
      return "success"
    case "overpaid":
      return "info"
    default:
      return "neutral"
  }
}
