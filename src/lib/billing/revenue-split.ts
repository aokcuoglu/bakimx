import type { BillingCycle } from "@prisma/client"
import { getOrderAmountSplit, isAddonOrderKey, priceRenewalAddonLines } from "@/lib/billing/addon-pricing"

/** Bu ay tahsilatı: paket ve ek özellik payı (#1049). Eski siparişler paket sayılır. */
export function splitMonthRevenue(
  orders: readonly { type: string; amountMinor: number; addonLines?: unknown }[],
): { packageMinor: number; addonMinor: number } {
  let packageMinor = 0
  let addonMinor = 0
  for (const o of orders) {
    const split = getOrderAmountSplit(o)
    packageMinor += split.packageAmountMinor
    addonMinor += split.addonAmountMinor
  }
  return { packageMinor, addonMinor }
}

/**
 * Hesaplarda satın alınmış ek özelliklerin aylık eşdeğeri (kuruş): yıllık
 * dönem 12'ye bölünür. Yenilemede tahsil edilen kalemlerle aynı kural:
 * şube başına/fiyatsız anahtarlar sayılmaz.
 */
export function computeAddonMrrMinor(
  workshops: readonly { paidAddons: readonly string[]; billingCycle: BillingCycle | null }[],
): number {
  let total = 0
  for (const w of workshops) {
    const cycle: BillingCycle = w.billingCycle ?? "monthly"
    const minor = priceRenewalAddonLines({ keys: w.paidAddons.filter(isAddonOrderKey), cycle }).reduce(
      (sum, l) => sum + l.amountMinor,
      0,
    )
    total += cycle === "yearly" ? Math.round(minor / 12) : minor
  }
  return total
}
