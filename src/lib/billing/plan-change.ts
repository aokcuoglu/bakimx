import { isPlanTier, PLAN_TIERS } from "@/lib/plan"

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

/**
 * Ödenmiş dönem açıkken alt pakete geçiş kapalıdır. BakımX iade yapmadığı için
 * dönem ortası düşürme özellikleri düşürüp ödenmiş süreyi boşa harcar;
 * yenileme ve yükseltme serbesttir.
 *
 * Engel YALNIZ dönem gerçekten açıkken geçerlidir (#782). Durum alanı tek
 * başına yetmez: dönemi bitmiş ama `subscriptionStatus` hâlâ `active` kalan ya
 * da dönemsiz (elle verilmiş) bir `premium` satırı, satışta tek paket kaldığı
 * için başka hiçbir şey satın alamaz hale gelirdi. Durum parametresi çağıranlar
 * kırılmasın diye korunur; karar `currentPeriodEnd`'e dayanır.
 */
export function isDowngradeBlocked(input: {
  subscriptionStatus: string | null | undefined
  planTier: string | null | undefined
  currentPeriodEnd: Date | string | null | undefined
  targetTier: string
  now?: Date
}): boolean {
  if (!isPlanDowngrade(input.planTier, input.targetTier)) return false
  if (input.currentPeriodEnd == null) return false
  const now = input.now ?? new Date()
  return new Date(input.currentPeriodEnd).getTime() > now.getTime()
}

/**
 * {@link isDowngradeBlocked} engellediğinde kullanıcının gördüğü metin. Satışta
 * tek paket olduğu için "daha düşük paket" demez: engel yalnız dönemi süren
 * eski bir satırdan (ör. `premium`) Servis Paketi'ne geçişte çıkar (#830).
 */
export const DOWNGRADE_BLOCKED_MESSAGE =
  "Ödenmiş dönem sürerken paket değiştirilemez. Mevcut paketiniz dönem sonuna kadar devam eder; dönem bittiğinde Servis Paketi'ni alabilirsiniz. Ücret iadesi yapılmaz."
