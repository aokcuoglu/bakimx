import { getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"

export const REFERRAL_DISCOUNT_BPS = 1000

/** The offer ends at the first UTC anniversary of the referred workshop's registration. */
export function getReferralDiscountBps(workshop: { referredByWorkshopId: string | null; createdAt: Date }, now = new Date()): number {
  if (!workshop.referredByWorkshopId) return 0
  const anniversary = new Date(workshop.createdAt)
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1)
  return now >= workshop.createdAt && now < anniversary ? REFERRAL_DISCOUNT_BPS : 0
}

export function applyDiscountMinor(amountMinor: number, discountBps: number): number {
  return Math.round(amountMinor * (10_000 - discountBps) / 10_000)
}

export function getDiscountedPlanPriceMinor(tier: PlanTier, cycle: BillingCycle, discountBps: number): number {
  return applyDiscountMinor(getPlanPriceMinor(tier, cycle), discountBps)
}

/** Legacy orders have no referral discount; only confirmed order snapshots are used for period credit. */
export function getOrderReferralDiscountBps(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return 0
  return (snapshot as Record<string, unknown>).referralDiscountBps === REFERRAL_DISCOUNT_BPS ? REFERRAL_DISCOUNT_BPS : 0
}
