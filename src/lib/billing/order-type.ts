import type { BillingOrderType } from "@prisma/client"
import { isPlanTier, PLAN_TIERS } from "@/lib/plan"

/**
 * Bir satın alma talebinin tipini türetir (saf fonksiyon — DB'siz test edilebilir):
 *  - dönem hiç başlamadıysa (currentPeriodEnd == null) → ilk alım (new_purchase)
 *  - AYNI paket → yenileme (renewal); dönem sonundan uzar, gün
 *    kaybı olmaz (bkz. activate.ts + period.ts). Aynı paketin yenilenmesi
 *    KASITLI olarak mümkündür — mükerrer talep (bekleyen sipariş) ayrı bir
 *    guard ile (duplicate-pending) engellenir, tip türetmesi engellemez.
 *  - daha üst paket → yükseltme (upgrade)
 *  - daha alt paket → düşürme (downgrade)
 */
export function deriveBillingOrderType(input: {
  subscriptionStatus: string | null
  planTier: string | null
  currentPeriodEnd: Date | null
  targetTier: string
}): BillingOrderType {
  if (input.currentPeriodEnd == null) return "new_purchase"
  if (input.planTier === input.targetTier) return "renewal"
  if (!isPlanTier(input.planTier) || !isPlanTier(input.targetTier)) {
    throw new Error("Paket sırası belirlenemedi.")
  }
  return PLAN_TIERS.indexOf(input.targetTier) > PLAN_TIERS.indexOf(input.planTier)
    ? "upgrade"
    : "downgrade"
}
