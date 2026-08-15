// Utility functions for BakIMX order management

export function getOrderStatusLabel(status: string): { label: string; variant: string } {
  const labels: Record<string, { label: string; variant: string }> = {
    pending: { label: "Beklemede", variant: "outline" },
    confirmed: { label: "Onaylandı", variant: "secondary" },
    payment_requested: { label: "Ödeme Bekleniyor", variant: "secondary" },
    failed_to_sync: { label: "Senkron Başarısız", variant: "destructive" },
    shipped: { label: "Gönderilen", variant: "default" },
    delivered: { label: "Teslim Alındı", variant: "default" },
    return_requested: { label: "İade Talep Edildi", variant: "outline" },
    return_accepted: { label: "İade Kabul Edildi", variant: "outline" },
    cancelled: { label: "İptal Edildi", variant: "secondary" }
  }
  return labels[status] || { label: status, variant: "secondary" }
}

export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: "Ödenmemiş",
    partial: "Kısmi Ödeme",
    paid: "Ödendi"
  }
  return labels[status] || status
}

export function canUpdateOrderStatus(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["payment_requested", "cancelled"],
    payment_requested: ["confirmed", "failed_to_sync", "cancelled"],
    failed_to_sync: ["payment_requested", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: ["return_requested"],
    return_requested: ["return_accepted", "cancelled"],
    return_accepted: [],
    cancelled: []
  }

  const allowed = validTransitions[currentStatus] || []
  return allowed.includes(newStatus)
}

export function isOrderEditable(status: string): boolean {
  // Orders can only be edited in pending/confirmed status
  return ["pending", "confirmed"].includes(status)
}

export function isOrderCancellable(status: string): boolean {
  // Orders can be cancelled from most states except delivered and return_accepted
  return !["delivered", "return_accepted"].includes(status)
}

export function formatOrderNumber(id: string): string {
  // Format order number as BX-<timestamp>-<id>
  return `BX-${Date.now()}-${id.slice(0, 8).toUpperCase()}`
}

export function calculateOrderTotalWithTax(
  subtotalKurus: number,
  taxRateBps: number = 2000 // 20% VAT
): { subtotal: number; tax: number; total: number } {
  const tax = Math.round(subtotalKurus * (taxRateBps / 10000))
  const total = subtotalKurus + tax

  return {
    subtotal: subtotalKurus,
    tax,
    total
  }
}

export const ORDER_STATUS_COLORS = {
  pending: "yellow",
  confirmed: "blue",
  payment_requested: "orange",
  failed_to_sync: "red",
  shipped: "green",
  delivered: "green",
  return_requested: "purple",
  return_accepted: "gray",
  cancelled: "gray"
} as const

export const PAYMENT_STATUS_COLORS = {
  unpaid: "red",
  partial: "yellow",
  paid: "green"
} as const
