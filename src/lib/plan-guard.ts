import { NextResponse } from "next/server"
import { assertWriteAccess, PlanWriteLockedError } from "@/lib/plan"
import type { Workshop } from "@prisma/client"

/**
 * API-route write guard for the read-only (plan-expired) lock.
 *
 * Call at the top of a mutating tenant API route, right after resolving the
 * workshop. Returns a `403 { error: "plan_locked", message }` NextResponse when
 * the workshop is in read-only mode, or `null` when writes are allowed (let the
 * handler proceed). Kept in a separate module from `plan.ts` so the pure plan
 * logic stays importable from the (non-Next) test/runtime without pulling in
 * `next/server`.
 *
 * Usage:
 *   const locked = assertWritableOr403(workshop)
 *   if (locked) return locked
 */
export function assertWritableOr403(
  workshop: Parameters<typeof assertWriteAccess>[0] & Partial<Workshop>
): NextResponse | null {
  try {
    assertWriteAccess(workshop)
    return null
  } catch (e) {
    if (e instanceof PlanWriteLockedError) {
      return NextResponse.json({ error: "plan_locked", message: e.message }, { status: 403 })
    }
    throw e
  }
}
