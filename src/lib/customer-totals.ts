import type { OrderStatus, PaymentStatus } from "@prisma/client"
import { sumKurus } from "@/lib/money"

// All money values are integer kuruş.

export type CustomerOrderLike = {
  status: OrderStatus | string
  paymentStatus: PaymentStatus | string
  items: Array<{ totalPrice: number | null; unitPrice: number | null; quantity: number }>
}

const ACTIVE_STATUSES: OrderStatus[] = ["draft", "waiting_approval", "approved", "in_progress", "waiting_parts"]
const CANCELLED: OrderStatus[] = ["cancelled"]
const DELIVERED: OrderStatus[] = ["delivered"]

export type CustomerBalanceRow = {
  ordersCount: number
  workDone: number
  grandTotal: number
  paid: number
  partial: number
  unpaid: number
  remaining: number
  customerCredit: number
  lastActivityAt: string | null
  hasOverdue: boolean
}

const empty: CustomerBalanceRow = {
  ordersCount: 0,
  workDone: 0,
  grandTotal: 0,
  paid: 0,
  partial: 0,
  unpaid: 0,
  remaining: 0,
  customerCredit: 0,
  lastActivityAt: null,
  hasOverdue: false,
}

export function calculateLineTotal(item: { totalPrice: number | null; unitPrice: number | null; quantity: number }): number {
  if (item.totalPrice != null && item.totalPrice > 0) return Math.trunc(item.totalPrice)
  if (item.unitPrice != null && item.unitPrice > 0) return Math.trunc(item.unitPrice) * item.quantity
  return 0
}

export function calculateOrderGrandTotal(items: CustomerOrderLike["items"]): number {
  return sumKurus(items.map(calculateLineTotal))
}

export function summarizeCustomerOrders(
  orders: CustomerOrderLike[],
  lastActivityAt: Date | string | null = null
): CustomerBalanceRow {
  if (!orders || orders.length === 0) {
    return { ...empty, lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null }
  }

  let grandTotal = 0
  let paid = 0
  let partial = 0
  let unpaid = 0
  let remaining = 0
  let customerCredit = 0
  let workDone = 0
  let hasOverdue = false

  for (const order of orders) {
    const total = calculateOrderGrandTotal(order.items)
    if (total <= 0) continue
    grandTotal += total

    if (order.paymentStatus === "paid") {
      paid += total
    } else if (order.paymentStatus === "partial") {
      partial += total
      remaining += total
    } else if (order.paymentStatus === "unpaid") {
      unpaid += total
      remaining += total
    } else if (order.paymentStatus === "cancelled") {
      continue
    }

    if (CANCELLED.includes(order.status as OrderStatus)) continue
    if (DELIVERED.includes(order.status as OrderStatus)) {
      customerCredit += total
    } else if (ACTIVE_STATUSES.includes(order.status as OrderStatus) || order.status === "ready_for_delivery") {
      workDone += 1
      const isUnpaidOrPartial = order.paymentStatus === "unpaid" || order.paymentStatus === "partial"
      const status = order.status as OrderStatus
      if (
        isUnpaidOrPartial &&
        (status === "delivered" || status === "ready_for_delivery")
      ) {
        hasOverdue = true
      }
    }
  }

  return {
    ordersCount: orders.length,
    workDone,
    grandTotal,
    paid,
    partial,
    unpaid,
    remaining,
    customerCredit,
    lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
    hasOverdue,
  }
}

export const ACTIVE_ORDER_STATUSES = ACTIVE_STATUSES
