import type { UserRole } from "@prisma/client"
import { hasFeature, hasWorkshopFeature, type GatedFeature, type WorkshopEntitlementFields } from "@/lib/plan"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"

/**
 * Araç kabulünün ve araç formlarının hangi girişleri gösterdiği (#828).
 *
 * Sunucu sayfası atölyenin erişim profilinden ve oturumdaki kullanıcının
 * rolünden bir kez hesaplar; istemciye yalnız bu düz boolean nesnesi gider
 * (bileşenler paket adını ya da `hasFeature`'ı bilmez). Böylece 403'e giden bir
 * düğme hiç render edilmez.
 *
 * Ek özellikler (ruhsat OCR, şaseden araç tanıma) paketten (`premium` profili,
 * aktif deneme) ya da atölyenin kendi `addons` listesinden açılır (#827); karar
 * tek yerde, `hasWorkshopFeature`'da verilir — burada ayrı bir kural yok.
 */
export type IntakeEntitlements = {
  /** Ruhsat OCR (ek özellik): ruhsat kartı, ruhsat kamerası. */
  ocrIntake: boolean
  /** Şaseden araç tanıma (ek özellik): şase kamerası, "Şaseden getir", otomatik şase sorgusu. */
  vinLookup: boolean
  /** Kabul fotoğrafı (pakette). */
  photoChecklist: boolean
  /** Hasar haritası (pakette). */
  damageMap: boolean
  /**
   * Kilitli ek özelliğin yerine kompakt tanıtım notu gösterilsin mi? Saha
   * rolleri (usta/çırak/staff) satın alma kararı vermez; onlarda giriş yalnız
   * gizlenir, elle giriş yolları açık kalır.
   */
  showAddonUpsell: boolean
}

/** Araç formlarının (araç sayfası, satır içi araç diyaloğu) ihtiyacı olan alt küme. */
export type VehicleCaptureEntitlements = Pick<IntakeEntitlements, "ocrIntake" | "vinLookup" | "showAddonUpsell">

/**
 * Atölye (deneme dahil — `getPlanState` aktif denemeyi `TRIAL_ACCESS_TIER`'a
 * çözer; atölye bazında açılmış ek özellikler `addons`'tan gelir) ve rolden
 * yetki nesnesini üretir. Atölye satırı yoksa varsayılan Servis Paketi
 * haklarıdır: paket özellikleri açık, ek özellikler kapalı.
 */
export function resolveIntakeEntitlements(
  workshop: WorkshopEntitlementFields | null,
  role: UserRole,
): IntakeEntitlements {
  const has = (feature: GatedFeature) =>
    workshop ? hasWorkshopFeature(workshop, feature) : hasFeature("pro", feature)
  return {
    ocrIntake: has("ocrIntake"),
    vinLookup: has("vinLookup"),
    photoChecklist: has("photoChecklist"),
    damageMap: has("damageMap"),
    showAddonUpsell: !isTechnicianRestrictedRole(role),
  }
}
