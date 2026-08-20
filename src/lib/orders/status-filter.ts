import type { OrderStatus } from "@prisma/client"

export const ACTIVE_ORDER_FILTER = "active"

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
]

export type OrderStatusFilterWhere =
  | Record<string, never>
  | { status: OrderStatus }
  | { status: { in: OrderStatus[] } }

export type ResolvedOrderStatusFilter = {
  value: string
  where: OrderStatusFilterWhere
}

const ORDER_STATUSES: OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  "ready_for_delivery",
  "delivered",
  "cancelled",
]

/**
 * URL'deki durum filtresini doğrular. KPI kartındaki `active` sanal değeri,
 * kart sayımında kullanılan açık iş emri statülerinin tamamına genişletilir.
 */
export function resolveOrderStatusFilter(raw: string | null | undefined): ResolvedOrderStatusFilter {
  const value = (raw || "").trim()

  if (value === ACTIVE_ORDER_FILTER) {
    return { value, where: { status: { in: ACTIVE_ORDER_STATUSES } } }
  }

  if ((ORDER_STATUSES as string[]).includes(value)) {
    return { value, where: { status: value as OrderStatus } }
  }

  return { value: "", where: {} }
}
