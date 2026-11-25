import type { BillingOrderType } from "@prisma/client"
import { isPlanTier, PLAN_TIERS } from "@/lib/plan"

/**
 * Bir satın alma talebinin tipini türetir (saf fonksiyon — DB'siz test edilebilir):
 *  - dönem hiç başlamadıysa (currentPeriodEnd == null) → ilk alım (new_purchase)
 *  - AYNI paket → yenileme (renewal); dönem sonundan uzar, gün
 *    kaybı olmaz (bkz. activate.ts + period.ts). Aynı paketin yenilenmesi
 *    KASITLI olarak mümkündür — mükerrer talep (bekleyen sipariş) ayrı bir
 *    guard ile (duplicate-pending) engellenir, tip türetmesi engellemez.
 *  - dönemi BİTMİŞ bir abonelikte farklı paket → ilk alım (new_purchase):
 *    devreden kredi yoktur, tam fiyat ödenir ve dönem bugünden başlar (#782).
 *  - açık dönemde daha üst paket → yükseltme (upgrade)
 *  - açık dönemde daha alt paket → düşürme (downgrade)
 */
export function deriveBillingOrderType(input: {
  subscriptionStatus: string | null
  planTier: string | null
  currentPeriodEnd: Date | null
  targetTier: string
  now?: Date
}): BillingOrderType {
  if (input.currentPeriodEnd == null) return "new_purchase"
  if (input.planTier === input.targetTier) return "renewal"
  const now = input.now ?? new Date()
  if (input.currentPeriodEnd.getTime() <= now.getTime()) return "new_purchase"
  if (!isPlanTier(input.planTier) || !isPlanTier(input.targetTier)) {
    throw new Error("Paket sırası belirlenemedi.")
  }
  return PLAN_TIERS.indexOf(input.targetTier) > PLAN_TIERS.indexOf(input.planTier)
    ? "upgrade"
    : "downgrade"
}
