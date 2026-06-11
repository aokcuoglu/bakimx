import { formatTRY } from "@/lib/format"

export type OrderLineItem = {
  type: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
}

export type OrderTotalsOptions = {
  discountAmount?: number | null
  taxRate?: number | null
}

export type MinimalLineItem = {
  totalPrice: number | null
  unitPrice: number | null
  quantity: number
}

export function calculateMinimalTotal(items: MinimalLineItem[]): number {
  return items.reduce((sum, item) => {
    if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
    if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
    return sum
  }, 0)
}

export function calculateOrderTotalsFromMinimal(
  items: MinimalLineItem[],
  options: OrderTotalsOptions = {}
): {
  grandTotal: number
  hasAnyPrice: boolean
} {
  const subtotal = calculateMinimalTotal(items)
  const discountAmount = Math.max(0, options.discountAmount ?? 0)
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxRate = options.taxRate ?? 0
  const taxAmount = (afterDiscount * taxRate) / 100
  const grandTotal = afterDiscount + taxAmount
  const hasAnyPrice = items.some(
    (i) => (i.totalPrice != null && i.totalPrice > 0) || (i.unitPrice != null && i.unitPrice > 0)
  )
  return { grandTotal, hasAnyPrice }
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

export function calculateOrderTotals(
  items: OrderLineItem[],
  options: OrderTotalsOptions = {}
): {
  partsTotal: number
  laborTotal: number
  subtotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  grandTotal: number
  partsCount: number
  laborCount: number
  hasAnyPrice: boolean
} {
  const partsTotal = calculateGroupTotal(items, "part")
  const laborTotal = calculateGroupTotal(items, "labor")
  const subtotal = partsTotal + laborTotal
  const discountAmount = Math.max(0, options.discountAmount ?? 0)
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxRate = options.taxRate ?? 0
  const taxAmount = (afterDiscount * taxRate) / 100
  const grandTotal = afterDiscount + taxAmount

  return {
    partsTotal,
    laborTotal,
    subtotal,
    discountAmount,
    taxRate,
    taxAmount,
    grandTotal,
    partsCount: items.filter((i) => i.type === "part").length,
    laborCount: items.filter((i) => i.type === "labor").length,
    hasAnyPrice: items.some(
      (i) => (i.totalPrice != null && i.totalPrice > 0) || (i.unitPrice != null && i.unitPrice > 0)
    ),
  }
}

export function formatOrderSummary(
  items: OrderLineItem[],
  options: OrderTotalsOptions = {}
): {
  partsTotal: string
  laborTotal: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  grandTotal: string
  partsCount: number
  laborCount: number
  hasAnyPrice: boolean
} {
  const totals = calculateOrderTotals(items, options)

  return {
    partsTotal: totals.partsCount > 0 ? formatTRY(totals.partsTotal) : "—",
    laborTotal: totals.laborCount > 0 ? formatTRY(totals.laborTotal) : "—",
    subtotal: totals.hasAnyPrice ? formatTRY(totals.subtotal) : "—",
    discountAmount: totals.discountAmount > 0 ? formatTRY(totals.discountAmount) : "—",
    taxAmount: totals.taxRate > 0 ? formatTRY(totals.taxAmount) : "—",
    grandTotal: totals.hasAnyPrice ? formatTRY(totals.grandTotal) : "—",
    partsCount: totals.partsCount,
    laborCount: totals.laborCount,
    hasAnyPrice: totals.hasAnyPrice,
  }
}