import { ADDON_CATALOG, type AddonCatalogItem } from "@/lib/plans-catalog"
import {
  getPlanState,
  hasFeature,
  hasWorkshopFeature,
  normalizeAddons,
  type AddonFeature,
  type WorkshopEntitlementFields,
} from "@/lib/plan"

/**
 * Ek özellik satırının atölyedeki durumu (#879).
 * - `active`: tüm kapılar kalıcı açık (ek özellik ya da paket).
 * - `trial`: tüm kapılar açık ama yalnız deneme süresince.
 * - `partial`: kapıların yalnız bir kısmı açık.
 * - `locked`: hiçbiri açık değil.
 * - `comingSoon`: kodda kapısı olmayan özellik.
 */
export type AddonRowState = "active" | "trial" | "partial" | "locked" | "comingSoon"

export interface AddonRowView {
  state: AddonRowState
  /** Yalnız `partial` durumunda dolu: açık olan kapılar. */
  openFeatures: readonly AddonFeature[]
}

export type AddonRowViews = Record<AddonCatalogItem["key"], AddonRowView>

export function getAddonRowView(
  item: AddonCatalogItem,
  workshop: WorkshopEntitlementFields,
): AddonRowView {
  if (item.features.length === 0) return { state: "comingSoon", openFeatures: [] }

  const plan = getPlanState(workshop)
  const addons = normalizeAddons(workshop.addons)
  const open = item.features.filter((f) => hasWorkshopFeature(workshop, f))
  if (open.length === 0) return { state: "locked", openFeatures: [] }
  if (open.length < item.features.length) return { state: "partial", openFeatures: open }

  const permanent = item.features.every(
    (f) => addons.includes(f) || (!plan.isTrialing && hasFeature(plan.accessTier, f)),
  )
  return { state: permanent ? "active" : "trial", openFeatures: [] }
}

export function resolveAddonRowViews(workshop: WorkshopEntitlementFields): AddonRowViews {
  return Object.fromEntries(
    ADDON_CATALOG.map((item) => [item.key, getAddonRowView(item, workshop)]),
  ) as AddonRowViews
}

/** Atölye bağlamı olmayan yüzeyler (/fiyatlar, kilit ekranı) için bugünkü görünüm. */
export const DEFAULT_ADDON_ROW_VIEWS: AddonRowViews = Object.fromEntries(
  ADDON_CATALOG.map((item): [AddonCatalogItem["key"], AddonRowView] => [
    item.key,
    { state: item.features.length === 0 ? "comingSoon" : "locked", openFeatures: [] },
  ]),
) as AddonRowViews
