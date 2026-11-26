import type { OrderStatusKey } from "@/lib/constants"

export type OrderStatusPillTone = "info" | "warning" | "success" | "destructive" | "neutral"

const ORDER_STATUS_TONE: Record<OrderStatusKey, OrderStatusPillTone> = {
  draft: "neutral",
  waiting_approval: "warning",
  approved: "info",
  in_progress: "info",
  waiting_parts: "warning",
  ready_for_delivery: "success",
  delivered: "success",
  cancelled: "destructive",
}

/**
 * İş emri durumu → hap tonu. Dashboard (`DashOrderStatus`) ve araç kabulü
 * detayı (`OrderStatusPill`) aynı kaynaktan okur; bilinmeyen durum nötr.
 */
export function orderStatusPillTone(status: string): OrderStatusPillTone {
  return Object.hasOwn(ORDER_STATUS_TONE, status) ? ORDER_STATUS_TONE[status as OrderStatusKey] : "neutral"
}
