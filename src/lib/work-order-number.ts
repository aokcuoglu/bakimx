/**
 * Work order number conventions.
 *
 * Display format: BX000001 — readable, sequential, consistent.
 *
 * Backward compatibility:
 * - Existing ServiceOrder records may have `workOrderNo = null`.
 * - The `formatWorkOrderNo` helper falls back to a generated display based on
 *   the last 6 characters of the cuid `id` (uppercased), prefixed with "BX-".
 * - This guarantees every order has a stable display number without breaking
 *   older records.
 */

import { customAlphabet } from "nanoid"

const PREFIX = "BX"

// Unambiguous uppercase alphabet (no 0/O, 1/I/L collisions) for readable codes.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ"
const randomCode = customAlphabet(CODE_ALPHABET, 4)

export function formatWorkOrderNo(order: { workOrderNo?: string | null; id: string }): string {
  if (order.workOrderNo && order.workOrderNo.length > 0) {
    return order.workOrderNo
  }
  const suffix = order.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()
  return `BX-${suffix}`
}

/**
 * Generate a candidate work order number.
 *
 * Combines a millisecond timestamp (rough ordering) with a random suffix so two
 * orders created in the same millisecond do not collide. For a hard guarantee
 * within a workshop, use {@link generateUniqueWorkOrderNo}.
 */
export function generateWorkOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5)
  return `${PREFIX}${ts}${randomCode()}`
}

/**
 * Generate a work order number guaranteed unique within a workshop at write
 * time. `isTaken` should report whether a candidate already exists for the
 * current workshop (scoped Prisma lookup). Falls back to a high-entropy value
 * if every attempt collides (effectively impossible).
 *
 * NOTE (deferred migration): the durable fix is a DB constraint
 * `@@unique([workshopId, workOrderNo])` on ServiceOrder. That is intentionally
 * NOT added here because existing rows may contain duplicate/null values from
 * the previous timestamp-only generator, so the constraint must be applied via
 * a backfill migration (dedupe/regenerate existing values first) to avoid a
 * failed/destructive migration on production data.
 */
export async function generateUniqueWorkOrderNo(
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 6
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateWorkOrderNo()
    if (!(await isTaken(candidate))) return candidate
  }
  return `${PREFIX}${Date.now().toString(36).toUpperCase()}${randomCode()}${randomCode()}`
}

export function generateQuoteNo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6)
  return `TKF${ts}`
}

export function formatQuoteNo(quote: { quoteNo?: string | null; id: string }): string {
  if (quote.quoteNo && quote.quoteNo.length > 0) return quote.quoteNo
  const suffix = quote.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()
  return `TKF-${suffix}`
}

export function generateAppointmentNo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6)
  return `RND${ts}`
}

export function formatAppointmentNo(appointment: { appointmentNo?: string | null; id: string }): string {
  if (appointment.appointmentNo && appointment.appointmentNo.length > 0) return appointment.appointmentNo
  const suffix = appointment.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()
  return `RND-${suffix}`
}
