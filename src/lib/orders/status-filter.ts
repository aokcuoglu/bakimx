import type { OrderStatus } from "@prisma/client"

export const ACTIVE_ORDER_FILTER = "active"

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
]

/**
 * Genel Bakış'taki "Serviste" kartı: teslim edilmemiş ve iptal edilmemiş her
 * iş emri. "Aktif"ten farkı teslime hazır araçları da saymasıdır — araç hâlâ
 * atölyededir. Kart sayımı ve kartın açtığı liste bu tek tanımı kullanır.
 */
export const IN_SERVICE_ORDER_FILTER = "in_service"

export const IN_SERVICE_ORDER_STATUSES: OrderStatus[] = [
  ...ACTIVE_ORDER_STATUSES,
  "ready_for_delivery",
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
  ...IN_SERVICE_ORDER_STATUSES,
  "delivered",
  "cancelled",
]

/**
 * URL'deki durum filtresini doğrular. İki sanal değer statü kümesine
 * genişletilir: `active` (listedeki "Aktif" sekmesi) ve `in_service`
 * (Genel Bakış'taki "Serviste" kartı).
 */
export function resolveOrderStatusFilter(raw: string | null | undefined): ResolvedOrderStatusFilter {
  const value = (raw || "").trim()

  if (value === ACTIVE_ORDER_FILTER) {
    return { value, where: { status: { in: ACTIVE_ORDER_STATUSES } } }
  }

  if (value === IN_SERVICE_ORDER_FILTER) {
    return { value, where: { status: { in: IN_SERVICE_ORDER_STATUSES } } }
  }

  if ((ORDER_STATUSES as string[]).includes(value)) {
    return { value, where: { status: value as OrderStatus } }
  }

  return { value: "", where: {} }
}
