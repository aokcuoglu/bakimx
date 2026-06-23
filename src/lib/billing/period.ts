import type { BillingCycle } from "@prisma/client"

/** Period end = start + 1 calendar month (monthly) or + 1 calendar year (yearly). */
export function addPeriod(start: Date, cycle: BillingCycle): Date {
  const d = new Date(start)
  if (cycle === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/**
 * New period start: extend from the current period end if it's still in the
 * future (early renewal must not shorten the paid window); otherwise start now.
 */
export function periodStartFrom(currentPeriodEnd: Date | null, now: Date): Date {
  return currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now
}
