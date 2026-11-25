import { z } from "zod/v4"
import { ADDON_FEATURES, normalizeAddons, type AddonFeature } from "@/lib/plan"

/**
 * Admin'in atölye bazında açtığı ek özellikler (#827).
 *
 * Sunucu bu şemayla doğrular; bilinmeyen anahtar reddedilir. Tekrarlar ve sıra
 * yazımdan önce `normalizeAddons` ile tekilleştirilir, yani istemci aynı
 * anahtarı iki kez gönderse de veritabanına bir kez girer.
 */
export const workshopAddonsSchema = z
  .array(z.enum(ADDON_FEATURES, { error: "Geçersiz ek özellik." }))
  .max(ADDON_FEATURES.length * 2, "Çok fazla ek özellik gönderildi.")

/**
 * Admin'in elle verdiği aylık ek katalog kotası (`Workshop.extraVinQuota`).
 * Taban kotanın ÜZERİNE eklenir; 0 = ek kota yok.
 */
export const extraVinQuotaSchema = z.coerce
  .number({ error: "Ek kota sayı olmalıdır." })
  .int("Ek kota tam sayı olmalıdır.")
  .min(0, "Ek kota negatif olamaz.")
  .max(100_000, "Ek kota en fazla 100.000 olabilir.")

/** Admin formunun değerleri: anahtar başına aç/kapa + ek kota. */
export const workshopAddonsFormSchema = z.object({
  addons: z.object(
    Object.fromEntries(ADDON_FEATURES.map((addon) => [addon, z.boolean()])) as Record<
      AddonFeature,
      z.ZodBoolean
    >,
  ),
  extraVinQuota: extraVinQuotaSchema,
})

export type WorkshopAddonsFormValues = z.infer<typeof workshopAddonsFormSchema>

/** Form anahtar haritasını (`{ vinLookup: true, … }`) sıralı ek özellik listesine çevirir. */
export function addonsFromToggles(toggles: Partial<Record<AddonFeature, boolean>>): AddonFeature[] {
  return ADDON_FEATURES.filter((addon) => toggles[addon] === true)
}

/** Ek özellik listesini form anahtar haritasına çevirir (bilinmeyen dize yok sayılır). */
export function togglesFromAddons(addons: readonly string[]): Record<AddonFeature, boolean> {
  const enabled = normalizeAddons(addons)
  return Object.fromEntries(
    ADDON_FEATURES.map((addon) => [addon, enabled.includes(addon)]),
  ) as Record<AddonFeature, boolean>
}

export interface AddonsDiff {
  before: AddonFeature[]
  after: AddonFeature[]
  added: AddonFeature[]
  removed: AddonFeature[]
}

/** Denetim kaydı için önce/sonra farkı — iki taraf da normalize edilir. */
export function diffAddons(before: readonly string[], after: readonly string[]): AddonsDiff {
  const prev = normalizeAddons(before)
  const next = normalizeAddons(after)
  return {
    before: prev,
    after: next,
    added: next.filter((addon) => !prev.includes(addon)),
    removed: prev.filter((addon) => !next.includes(addon)),
  }
}
