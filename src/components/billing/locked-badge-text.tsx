import { lockedFeatureLabels } from "@/lib/feature-catalog"
import type { GatedFeature } from "@/lib/plan"

/** Dar kilit rozetinin metni: görünen "Ek", ekran okuyucu "Ek özellik" duyar (#782). */
export function LockedBadgeText({ feature }: { feature: GatedFeature }) {
  const { badge, badgeSrSuffix } = lockedFeatureLabels(feature)
  return (
    <>
      {badge}
      {badgeSrSuffix && <span className="sr-only">{badgeSrSuffix}</span>}
    </>
  )
}
