import type { IntakeStatus, OrderStatus, PaymentStatus } from "@prisma/client"

/**
 * Safe status-transition helpers.
 *
 * Goal: prevent arbitrary/garbage status values and illegal jumps from being
 * written through the generic status actions / API routes. The maps mirror the
 * transitions the UI actually offers (see intake-detail.tsx / order-detail.tsx).
 *
 * LEGACY: `approved` is no longer produced by any flow — customer approval moved
 * to the delivery stage (delivery OTP). The generic action still refuses to set
 * `approved` so the status can't be reintroduced by hand; older records already in
 * `approved` keep their onward transitions.
 */

export const INTAKE_STATUSES = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "ready_for_delivery",
  "delivered",
  "cancelled",
] as const

export const ORDER_STATUSES = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
  "ready_for_delivery",
  "delivered",
  "cancelled",
] as const

export const PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "overpaid",
  "cancelled",
] as const

export function isIntakeStatus(value: string): value is IntakeStatus {
  return (INTAKE_STATUSES as readonly string[]).includes(value)
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value)
}

// `approved` is intentionally absent from every target list — it is a legacy status
// no longer produced. Customer approval now happens at DELIVERY (delivery OTP), not at
// intake, so a draft work order starts directly: draft → in_progress. The legacy `waiting_approval`/`approved`
// rows are kept so older records in those states can still progress.
const INTAKE_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  draft: ["in_progress", "cancelled"],
  waiting_approval: ["draft", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["delivered", "in_progress", "cancelled"],
  delivered: [],
  cancelled: ["draft"],
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["in_progress", "waiting_approval", "cancelled"],
  waiting_approval: ["approved", "in_progress", "cancelled"],
  approved: ["in_progress", "waiting_parts", "cancelled"],
  in_progress: ["waiting_parts", "ready_for_delivery", "cancelled"],
  waiting_parts: ["in_progress", "ready_for_delivery", "cancelled"],
  ready_for_delivery: ["delivered", "in_progress", "cancelled"],
  delivered: [],
  cancelled: ["draft"],
}

/**
 * Whether an intake may move from `from` to `to` via the generic status action.
 * A no-op (from === to) is allowed; a manual move to `approved` is always denied.
 */
export function canTransitionIntake(from: IntakeStatus, to: IntakeStatus): boolean {
  if (to === "approved") return false
  if (to === "delivered") return false
  if (from === to) return true
  return INTAKE_TRANSITIONS[from]?.includes(to) ?? false
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * `delivered`/`cancelled` are terminal for order *composition* (parts, labor,
 * pricing, technician assignment, checklist, notes, parts requests, labor
 * sessions) — the vehicle has left or the job never happened, so nothing about
 * what was done to it should still be editable. `cancelled` can still reactivate
 * to `draft` (see ORDER_TRANSITIONS), which unlocks it again.
 */
export function isOrderLocked(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled"
}
