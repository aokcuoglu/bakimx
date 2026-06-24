import { getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"

const DAY_MS = 86_400_000
// Nominal cycle lengths used for crediting the unused portion of the current
// plan. Approximate (months vary) — the credit is a goodwill adjustment, not an
// accounting-exact figure.
const CYCLE_DAYS: Record<BillingCycle, number> = { monthly: 30, yearly: 365 }

/**
 * Amount (kuruş) to charge for a mid-cycle UPGRADE. The unused portion of the
 * current plan's period is credited against the new plan's full price; on
 * confirm the workshop gets a fresh full period at the new tier (see
 * confirmBillingOrder). The charge is floored at 0 so a large credit (or a
 * "downgrade" routed through the upgrade path) never goes negative.
 *
 * For new_purchase / renewal this is not used — they pay the full plan price.
 */
export function computeUpgradeAmountMinor(params: {
  currentTier: PlanTier
  currentCycle: BillingCycle
  currentPeriodEnd: Date | null
  newTier: PlanTier
  newCycle: BillingCycle
  now: Date
}): number {
  const { currentTier, currentCycle, currentPeriodEnd, newTier, newCycle, now } = params
  const full = getPlanPriceMinor(newTier, newCycle)
  if (!currentPeriodEnd) return full
  const remainingMs = currentPeriodEnd.getTime() - now.getTime()
  if (remainingMs <= 0) return full
  const fraction = Math.min(1, remainingMs / (CYCLE_DAYS[currentCycle] * DAY_MS))
  const creditMinor = Math.round(getPlanPriceMinor(currentTier, currentCycle) * fraction)
  return Math.max(0, full - creditMinor)
}
