import type { BillingOrderType } from "@prisma/client"

/**
 * Bir satın alma talebinin tipini türetir (saf fonksiyon — DB'siz test edilebilir):
 *  - dönem hiç başlamadıysa (currentPeriodEnd == null) → ilk alım (new_purchase)
 *  - aktif abonelik + AYNI paket → yenileme (renewal); dönem sonundan uzar, gün
 *    kaybı olmaz (bkz. activate.ts + period.ts). Aynı paketin yenilenmesi
 *    KASITLI olarak mümkündür — mükerrer talep (bekleyen sipariş) ayrı bir
 *    guard ile (duplicate-pending) engellenir, tip türetmesi engellemez.
 *  - aksi halde → yükseltme (upgrade); kalan gün kredisi düşülür.
 */
export function deriveBillingOrderType(input: {
  subscriptionStatus: string | null
  planTier: string | null
  currentPeriodEnd: Date | null
  targetTier: string
}): BillingOrderType {
  if (input.currentPeriodEnd == null) return "new_purchase"
  if (input.subscriptionStatus === "active" && input.planTier === input.targetTier) {
    return "renewal"
  }
  return "upgrade"
}
