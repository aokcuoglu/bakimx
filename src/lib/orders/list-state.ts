import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table"
import { ORDER_LIST_DATA_COLUMN_ORDER } from "./list-columns"

export type OrderListState = {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
}

export function readOrderListState(raw: string | null): OrderListState {
  const defaults: OrderListState = { sorting: [], columnFilters: [], columnVisibility: { delivery: false } }
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw)
    const validId = (id: unknown) => ORDER_LIST_DATA_COLUMN_ORDER.some((column) => column === id)
    return {
      sorting: Array.isArray(parsed.sorting) ? parsed.sorting.filter((item: { id?: unknown; desc?: unknown } | null) => item && validId(item.id) && typeof item.desc === "boolean") : [],
      columnFilters: Array.isArray(parsed.columnFilters) ? parsed.columnFilters.filter((item: { id?: unknown; value?: unknown } | null) => item && validId(item.id) && typeof item.value === "string") : [],
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
