/**
 * Ek özellik yazımının hedef atölyeleri (#829). Ek özellikler hesap başınadır:
 * organizasyonun tüm müşteri şubelerine yayılır; organizasyonsuz atölye tek
 * başınadır. Admin eylemi ve CLI aynı çözümlemeyi kullanır.
 */
import { diffAddons, type AddonsDiff } from "../validations/workshop-addons"

export interface AddonTarget {
  id: string
  addons: string[]
}

export interface AddonTargetClient {
  workshop: {
    findFirst(args: {
      where: { id: string; kind: "customer" }
      select: { id: true; addons: true; organizationId: true }
    }): Promise<{ id: string; addons: string[]; organizationId: string | null } | null>
    findMany(args: {
      where: { organizationId: string; kind: "customer" }
      select: { id: true; addons: true }
    }): Promise<{ id: string; addons: string[] }[]>
  }
}

/**
 * Seçilen atölye + (varsa) organizasyonunun tüm müşteri şubeleri. Atölye yoksa
 * ya da müşteri değilse `null`. Seçilen atölye her zaman ilk sıradadır.
 */
export async function resolveAddonTargets(
  db: AddonTargetClient,
  workshopId: string,
): Promise<AddonTarget[] | null> {
  const workshop = await db.workshop.findFirst({
    where: { id: workshopId, kind: "customer" },
    select: { id: true, addons: true, organizationId: true },
  })
  if (!workshop) return null
  const self: AddonTarget = { id: workshop.id, addons: workshop.addons }
  if (!workshop.organizationId) return [self]
  const siblings = await db.workshop.findMany({
    where: { organizationId: workshop.organizationId, kind: "customer" },
    select: { id: true, addons: true },
  })
  return [self, ...siblings.filter((s) => s.id !== workshop.id)]
}

export interface AddonFanOutPlan {
  /** Hiçbir hedef değişmiyorsa true — yalnızca TÜM hedefler eşitse no-op. */
  noop: boolean
  workshopIds: string[]
  /** Hedef başına önce/sonra farkı (şube başına denetim kaydı için). */
  entries: { id: string; diff: AddonsDiff }[]
}

export function planAddonFanOut(targets: readonly AddonTarget[], next: readonly string[]): AddonFanOutPlan {
  const entries = targets.map((target) => ({ id: target.id, diff: diffAddons(target.addons, next) }))
  return {
    noop: entries.every(({ diff }) => diff.added.length === 0 && diff.removed.length === 0),
    workshopIds: targets.map((target) => target.id),
    entries,
  }
}
