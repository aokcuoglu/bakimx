import { getPlanPackage } from "@/lib/plans-catalog"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"

/**
 * Charged amount in kuruş (Int) for a tier/cycle. Catalog prices are
 * VAT-included and final — the customer pays the displayed amount.
 */
export function getPlanPriceMinor(tier: PlanTier, cycle: BillingCycle): number {
  const pkg = getPlanPackage(tier)
  if (!pkg) throw new Error(`Bilinmeyen paket: ${tier}`)
  const lira = cycle === "yearly" ? pkg.yearlyPrice : pkg.monthlyPrice
  return Math.round(lira * 100)
}

/** Format a kuruş amount as Turkish Lira, e.g. 129900 -> "₺1.299,00". */
export function formatMinor(minor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(minor / 100)
}
