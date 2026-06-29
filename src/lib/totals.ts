import { sumKurus, applyDiscountKurus, applyTaxBps, addKurus, formatKurus } from "@/lib/money"

/**
 * Order/quote totals. All money values are integer KURUŞ; `taxRate` is integer
 * BASIS POINTS (bps; %20 = 2000). money.ts is the single rounding authority —
 * kuruş addition is exact, only the tax share rounds.
 */

export type OrderLineItem = {
  type: string
  name: string
  quantity: number
  unitPrice: number | null // kuruş
  totalPrice: number | null // kuruş
}

export type OrderTotalsOptions = {
  discountAmount?: number | null // kuruş
  taxRate?: number | null // bps
}

export type MinimalLineItem = {
  totalPrice: number | null // kuruş
  unitPrice: number | null // kuruş
  quantity: number
}

/** Line total in kuruş: explicit totalPrice wins, else unitPrice * quantity. */
function lineTotalKurus(item: MinimalLineItem): number {
  if (item.totalPrice != null && item.totalPrice > 0) return Math.trunc(item.totalPrice)
  if (item.unitPrice != null && item.unitPrice > 0) return Math.trunc(item.unitPrice) * item.quantity
  return 0
}

function hasPrice(item: MinimalLineItem): boolean {
  return (item.totalPrice != null && item.totalPrice > 0) || (item.unitPrice != null && item.unitPrice > 0)
}

export function calculateMinimalTotal(items: MinimalLineItem[]): number {
  return sumKurus(items.map(lineTotalKurus))
}

export function calculateOrderTotalsFromMinimal(
  items: MinimalLineItem[],
  options: OrderTotalsOptions = {}
): {
  grandTotal: number
  hasAnyPrice: boolean
} {
  const subtotal = calculateMinimalTotal(items)
  const afterDiscount = applyDiscountKurus(subtotal, Math.max(0, options.discountAmount ?? 0))
  const taxAmount = applyTaxBps(afterDiscount, options.taxRate ?? 0)
  const grandTotal = addKurus(afterDiscount, taxAmount)
  return { grandTotal, hasAnyPrice: items.some(hasPrice) }
}

export function calculateLineTotal(item: OrderLineItem): number | null {
  if (item.totalPrice != null && item.totalPrice > 0) return Math.trunc(item.totalPrice)
  if (item.unitPrice != null && item.unitPrice > 0) return Math.trunc(item.unitPrice) * item.quantity
  return null
}

export function formatLineTotal(item: OrderLineItem): string {
  const total = calculateLineTotal(item)
  if (total != null) return formatKurus(total)
  return "Fiyat girilmedi"
}

export function calculateGroupTotal(items: OrderLineItem[], type?: string): number {
  const filtered = type ? items.filter((i) => i.type === type) : items
  return sumKurus(filtered.map(lineTotalKurus))
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
  const subtotal = addKurus(partsTotal, laborTotal)
  const discountAmount = Math.max(0, Math.trunc(options.discountAmount ?? 0))
  const afterDiscount = applyDiscountKurus(subtotal, discountAmount)
  const taxRate = Math.max(0, Math.trunc(options.taxRate ?? 0))
  const taxAmount = applyTaxBps(afterDiscount, taxRate)
  const grandTotal = addKurus(afterDiscount, taxAmount)

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
    hasAnyPrice: items.some(hasPrice),
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
    partsTotal: totals.partsCount > 0 ? formatKurus(totals.partsTotal) : "—",
    laborTotal: totals.laborCount > 0 ? formatKurus(totals.laborTotal) : "—",
    subtotal: totals.hasAnyPrice ? formatKurus(totals.subtotal) : "—",
    discountAmount: totals.discountAmount > 0 ? formatKurus(totals.discountAmount) : "—",
    taxAmount: totals.taxRate > 0 ? formatKurus(totals.taxAmount) : "—",
    grandTotal: totals.hasAnyPrice ? formatKurus(totals.grandTotal) : "—",
    partsCount: totals.partsCount,
    laborCount: totals.laborCount,
    hasAnyPrice: totals.hasAnyPrice,
  }
}
