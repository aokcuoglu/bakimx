import { isPlanTier, PLAN_TIERS, type SalePlanTier } from "@/lib/plan"
import { PLAN_COMPARISON } from "@/lib/plans-catalog"

/**
 * Hedef paket mevcut paketten daha düşük mü? (lite < starter < pro < premium)
 */
export function isPlanDowngrade(
  currentTier: string | null | undefined,
  targetTier: string,
): boolean {
  if (!isPlanTier(currentTier) || !isPlanTier(targetTier)) return false
  return PLAN_TIERS.indexOf(targetTier) < PLAN_TIERS.indexOf(currentTier)
}

export function isPlanUpgrade(
  currentTier: string | null | undefined,
  targetTier: string,
): boolean {
  if (!isPlanTier(currentTier) || !isPlanTier(targetTier)) return false
  return PLAN_TIERS.indexOf(targetTier) > PLAN_TIERS.indexOf(currentTier)
}

/** Karşılaştırma tablosundan düşürmede kaybedilecek özellik etiketleri. */
export function getFeaturesLostOnDowngrade(
  fromTier: SalePlanTier,
  toTier: SalePlanTier,
): string[] {
  if (!isPlanDowngrade(fromTier, toTier)) return []
  const lost: string[] = []
  for (const category of PLAN_COMPARISON) {
    for (const row of category.rows) {
      const from = row.values[fromTier]
      const to = row.values[toTier]
      const fromOk = from.state === "included" || from.state === "text" || from.state === "coming-soon"
      const toGone = to.state === "unavailable"
      if (fromOk && toGone) lost.push(row.label)
    }
  }
  return lost
}

/**
 * Aktif abonelik / açık dönem içinde alt pakete geçiş kapalıdır.
 * BakımX iade yapmadığı için dönem ortası düşürme özellikleri düşürüp
 * ödenmiş süreyi boşa harcar; yenileme ve yükseltme serbesttir.
 */
export function isDowngradeBlocked(input: {
  subscriptionStatus: string | null | undefined
  planTier: string | null | undefined
  currentPeriodEnd: Date | null | undefined
  targetTier: string
  now?: Date
}): boolean {
  if (!isPlanDowngrade(input.planTier, input.targetTier)) return false
  const now = input.now ?? new Date()
  const periodOpen =
    input.currentPeriodEnd != null && input.currentPeriodEnd.getTime() > now.getTime()
  return input.subscriptionStatus === "active" || periodOpen
}

export const DOWNGRADE_BLOCKED_MESSAGE =
  "Aktif abonelik döneminde daha düşük pakete geçiş yapılamaz. Para iadesi olmadığı için mevcut paket dönem sonuna kadar devam eder."
