import { isAddonOrderKey, type AddonOrderKey } from "@/lib/billing/addon-pricing"
import type { GatedFeature } from "@/lib/plan"
import { ADDON_CATALOG } from "@/lib/plans-catalog"

/** Ayarlar → Paketler sayfasındaki ek özellikler bölümünün kimliği (başlık `id`'si). */
export const ADDON_SECTION_ID = "ayarlar-ek-ozellikler"

/** Ayarlar → Paketler sayfasındaki Servis Paketi kartının kimliği. */
export const PLAN_SECTION_ID = "ayarlar-paket"

/** Kapının ait olduğu, uygulama içinden satın alınabilen ek özellik; yoksa `null` (#829). */
export function purchasableAddonKeyForFeature(feature: GatedFeature): AddonOrderKey | null {
  const item = ADDON_CATALOG.find((a) => a.purchasable && a.features.some((f) => f === feature))
  return item && isAddonOrderKey(item.key) ? item.key : null
}

/** Kilitli yüzeylerden satın alma penceresini açan bağlantı. */
export function addonPurchaseHref(key: AddonOrderKey): string {
  return `/settings/plans?addon=${key}#${ADDON_SECTION_ID}`
}
