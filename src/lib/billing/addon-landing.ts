import { isAddonOrderKey, type AddonOrderKey } from "@/lib/billing/addon-pricing"
import type { AddonRowViews } from "@/lib/billing/addon-row-state"

export type AddonLandingReason =
  | "trial"
  | "contact"
  | "notAccount"
  | "noPermission"
  | "needsPackage"
  | "pendingOrder"

export const ADDON_LANDING_MESSAGES: Record<AddonLandingReason, string> = {
  trial: "Denemede bu özellik açık.",
  contact: "Bu ek özellik uygulama içinden satın alınamaz; bizimle iletişime geçin.",
  notAccount: "Ek özellikler ana şubeden satın alınır.",
  noPermission: "Satın alma için yöneticinizle görüşün.",
  needsPackage: "Ek özellik almak için önce Servis Paketi gerekir.",
  pendingOrder: "Bekleyen bir ödeme talebiniz var.",
}

export type AddonLanding =
  | { initialAddon: AddonOrderKey; notice?: undefined }
  | { initialAddon?: undefined; notice: { reason: AddonLandingReason; message: string } | null }

/**
 * `/settings/plans?addon=<anahtar>` ile gelen ziyaretçi için karar (#829): satın
 * alma penceresi yalnız gerçekten satın alınabiliyorsa açılır; açılmıyorsa
 * nedeni söylenir ki kilitli yüzeyden gelen kullanıcı çıkmaza düşmesin.
 */
export function resolveAddonLanding(input: {
  requested: string | undefined
  views: AddonRowViews
  canPurchase: boolean
  hasPendingOrder: boolean
}): AddonLanding {
  const { requested, views, canPurchase, hasPendingOrder } = input
  if (!isAddonOrderKey(requested)) return { notice: null }
  const reason = ((): AddonLandingReason | null => {
    switch (views[requested].state) {
      case "trial": return "trial"
      case "contact": return "contact"
      case "notAccount": return "notAccount"
      case "needsPackage": return canPurchase ? "needsPackage" : "noPermission"
      case "purchasable":
        if (!canPurchase) return "noPermission"
        return hasPendingOrder ? "pendingOrder" : null
      default: return null
    }
  })()
  if (reason === null) {
    return views[requested].state === "purchasable" ? { initialAddon: requested } : { notice: null }
  }
  return { notice: { reason, message: ADDON_LANDING_MESSAGES[reason] } }
}
