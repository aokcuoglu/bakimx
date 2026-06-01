import { formatTRY } from "@/lib/format"

export type OrderLineItem = {
  type: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
}

export function calculateLineTotal(item: OrderLineItem): number | null {
  if (item.totalPrice != null && item.totalPrice > 0) return item.totalPrice
  if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice * item.quantity
  return null
}

export function formatLineTotal(item: OrderLineItem): string {
  const total = calculateLineTotal(item)
  if (total != null) return formatTRY(total)
  return "Fiyat girilmedi"
}

export function calculateGroupTotal(items: OrderLineItem[], type?: string): number {
  const filtered = type ? items.filter((i) => i.type === type) : items
  return filtered.reduce((sum, item) => {
    if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
    if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
    return sum
  }, 0)
}

export function formatOrderSummary(items: OrderLineItem[]): {
  partsTotal: string
  laborTotal: string
  grandTotal: string
  partsCount: number
  laborCount: number
  hasAnyPrice: boolean
} {
  const parts = items.filter((i) => i.type === "part")
  const labor = items.filter((i) => i.type === "labor")

  const partsTotalRaw = calculateGroupTotal(items, "part")
  const laborTotalRaw = calculateGroupTotal(items, "labor")
  const grandTotalRaw = partsTotalRaw + laborTotalRaw

  const hasAnyPrice = items.some(
    (i) => (i.totalPrice != null && i.totalPrice > 0) || (i.unitPrice != null && i.unitPrice > 0)
  )

  return {
    partsTotal: parts.length > 0 ? formatTRY(partsTotalRaw) : "—",
    laborTotal: labor.length > 0 ? formatTRY(laborTotalRaw) : "—",
    grandTotal: items.length > 0 ? formatTRY(grandTotalRaw) : "—",
    partsCount: parts.length,
    laborCount: labor.length,
    hasAnyPrice,
  }
}