import type { VisibilityState } from "@tanstack/react-table"
import { ORDER_LIST_DATA_COLUMN_ORDER } from "./list-columns"

/**
 * `?view=` yalnız istemci tablo ayarını (kolon görünürlüğü) taşır. Sıralama
 * sunucuda (`?sort=&dir=`), kolon araması kaldırıldı (#831); eski bağlantılardaki
 * `sorting` / `columnFilters` anahtarları sessizce yok sayılır.
 */
export type OrderListState = {
  columnVisibility: VisibilityState
}

export function readOrderListState(raw: string | null): OrderListState {
  const defaults: OrderListState = { columnVisibility: { delivery: false } }
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw)
    const validId = (id: unknown) => ORDER_LIST_DATA_COLUMN_ORDER.some((column) => column === id)
    return {
      columnVisibility: { delivery: false, ...Object.fromEntries(Object.entries(parsed.columnVisibility ?? {}).filter(([id, value]) => validId(id) && typeof value === "boolean")) },
    }
  } catch {
    return defaults
  }
}

/** Only a local order list is a valid return destination. */
export function orderListReturnHref(raw?: string): string {
  if (!raw || !/^\/orders(?:\?|$)/.test(raw) || /[\\\r\n#]/.test(raw)) return "/orders"
  return raw
}

export function orderDetailHref(id: string, listHref: string, edit = false): string {
  const params = new URLSearchParams({ returnTo: orderListReturnHref(listHref) })
  if (edit) params.set("edit", "1")
  return `/orders/${id}?${params}`
}
