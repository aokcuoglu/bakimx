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

const PREFIX = "BX"

export function formatWorkOrderNo(order: { workOrderNo?: string | null; id: string }): string {
  if (order.workOrderNo && order.workOrderNo.length > 0) {
    return order.workOrderNo
  }
  const suffix = order.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()
  return `BX-${suffix}`
}

/**
 * Generate a new work order number for creation.
 * Uses a millisecond timestamp suffix to keep it unique within a workshop.
 */
export function generateWorkOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6)
  return `${PREFIX}${ts}`
}
