import type { IntakeStatus, OrderStatus, PaymentStatus } from "@prisma/client"

/**
 * Safe status-transition helpers.
 *
 * Goal: prevent arbitrary/garbage status values and illegal jumps from being
 * written through the generic status actions / API routes. The maps mirror the
 * transitions the UI actually offers (see intake-detail.tsx / order-detail.tsx).
 *
 * SECURITY: an intake reaches `approved` ONLY through the customer OTP approval
 * flow (`verifyOtpAction`), never through the generic status action — this
 * prevents bypassing customer approval. `canTransitionIntake` therefore always
 * rejects a manual transition to `approved`.
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

// `approved` is intentionally absent from every target list — it is owned by the OTP flow.
// Customer approval now happens at DELIVERY (delivery OTP), not at intake, so a draft
// work order starts directly: draft → in_progress. The legacy `waiting_approval`/`approved`
// rows are kept so older records in those states can still progress.
const INTAKE_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  draft: ["in_progress", "cancelled"],
  waiting_approval: ["draft", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["delivered", "in_progress", "cancelled"],
  delivered: [],
  cancelled: [],
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["in_progress", "waiting_approval", "cancelled"],
  waiting_approval: ["approved", "in_progress", "cancelled"],
  approved: ["in_progress", "waiting_parts", "cancelled"],
  in_progress: ["waiting_parts", "ready_for_delivery", "cancelled"],
  waiting_parts: ["in_progress", "ready_for_delivery", "cancelled"],
  ready_for_delivery: ["delivered", "in_progress", "cancelled"],
  delivered: [],
  cancelled: [],
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
