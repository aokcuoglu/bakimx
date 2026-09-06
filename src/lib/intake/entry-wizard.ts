/**
 * Kabul sihirbazının "araç girişi" bölümünün saf akış mantığı (#309).
 *
 * Kullanıcı önce bir yöntem seçer (ruhsat görseli / camdan şase / plaka ile ara /
 * müşteri ile ara); sihirbazın kaç adımdan oluştuğu ve adım etiketleri bu seçime
 * göre değişir. Karar mantığı bileşenden ayrı tutuldu ki adım rayı ile gerçek akış
 * asla ayrışmasın ve testlenebilsin.
 */

import { normalizePlate } from "@/lib/format"
import { normalizeVin } from "@/lib/vin/types"

export type EntryMethod = "registration" | "vin" | "plate" | "customer"
export type EntryStep = "method" | "capture" | "vehicle" | "owner" | "confirm"

export type EntryMethodOption = {
  value: EntryMethod
  title: string
  description: string
  /** Yönteme özel yakalama adımının ray etiketi. */
  captureLabel: string
}

export const ENTRY_METHODS: EntryMethodOption[] = [
  {
    value: "registration",
    title: "Ruhsat görseli",
    description: "Ruhsatı kamerayla çekin ya da dosyadan yükleyin; alanlar otomatik dolsun.",
    captureLabel: "Ruhsat",
  },
  {
    value: "vin",
    title: "Camdan şase",
    description: "Ön camdaki şase numarasını kamerayla okutun veya elle yazın.",
    captureLabel: "Şase",
  },
  {
    value: "plate",
    title: "Plaka ile ara",
    description: "Sistemde kayıtlı aracı plakasıyla bulun.",
    captureLabel: "Plaka",
  },
  {
    value: "customer",
    title: "Müşteri ile ara",
    description: "Kayıtlı müşteriyi bulun, araçlarından birini seçin.",
    captureLabel: "Müşteri",
  },
]

export function entryMethodOption(method: EntryMethod): EntryMethodOption {
  const found = ENTRY_METHODS.find((m) => m.value === method)
  if (!found) throw new Error(`Bilinmeyen yöntem: ${method}`)
  return found
}

/**
 * Ray etiketleri. Yöntem seçilmeden önce yakalama adımı genel ("Araç") görünür;
 * seçildikten sonra yöntemin kendi etiketiyle anlamlanır.
 *
 * `knownVehicle` — kayıtlı bir araç zaten bulunduysa araç/sahip alanları
 * doldurulmaz, doğrudan onaya gidilir; ray da bu iki adımı göstermez.
 */
export function entryStepLabels(
  method: EntryMethod | null,
  opts: { knownVehicle?: boolean } = {}
): { id: EntryStep; label: string }[] {
  const capture = method ? entryMethodOption(method).captureLabel : "Araç"
  const steps: { id: EntryStep; label: string }[] = [
    { id: "method", label: "Yöntem" },
    { id: "capture", label: capture },
  ]
  if (!opts.knownVehicle) {
    steps.push({ id: "vehicle", label: "Araç bilgileri" })
    steps.push({ id: "owner", label: "Müşteri" })
  }
  steps.push({ id: "confirm", label: "Onay" })
  return steps
}

/** Zorunlu araç alanları eksikse Türkçe hata metni, tamamsa `null`. */
export function vehicleFieldError(fields: { plate: string; brand: string; model: string }): string | null {
  const missing: string[] = []
  if (!fields.plate.trim()) missing.push("Plaka")
  if (!fields.brand.trim()) missing.push("Marka")
  if (!fields.model.trim()) missing.push("Model")
  if (!missing.length) return null
  return `${missing.join(", ")} zorunludur.`
}

/**
 * Ruhsat OCR'ı ile kullanıcının elle girdiği kimlik alanı çakışması.
 * `current` kullanıcının değeri (korunur), `scanned` ruhsattan okunan.
 */
export type IdentityConflict = {
  key: "plate" | "vin"
  label: string
  current: string
  scanned: string
}

/**
 * Kullanıcı sihirbaza plaka araması ya da camdan şase ile girdiyse o değer bir
 * **kimlik çıpasıdır**: aranan araç odur. Ruhsat OCR'ı aynı adımda farklı bir
 * plaka/şase okursa (yanlış ruhsat, yanlış hane) sessizce üzerine yazmak iş
 * emrini başka bir araca bağlar. Bu yüzden çakışma bildirilir, kullanıcı seçer.
 *
 * Boş alanda çakışma yoktur — ruhsattan gelen değer doğrudan uygulanır.
 */
export function identityConflicts(
  current: { plate: string; vin: string },
  scanned: { plate: string; vin: string }
): IdentityConflict[] {
  const conflicts: IdentityConflict[] = []
  const plate = { current: normalizePlate(current.plate), scanned: normalizePlate(scanned.plate) }
  if (plate.current && plate.scanned && plate.current !== plate.scanned) {
    conflicts.push({ key: "plate", label: "Plaka", current: current.plate.trim(), scanned: scanned.plate.trim() })
  }
  const vin = { current: normalizeVin(current.vin), scanned: normalizeVin(scanned.vin) }
  if (vin.current && vin.scanned && vin.current !== vin.scanned) {
    conflicts.push({ key: "vin", label: "Şase no", current: vin.current, scanned: vin.scanned })
  }
  return conflicts
}

/**
 * Bir adımdan geri dönüldüğünde nereye gidilir? Ray etiketleriyle aynı listeden
 * türetilir ki "Geri" ile rayda görünmeyen bir adıma düşmek mümkün olmasın.
 */
export function previousEntryStep(
  current: EntryStep,
  method: EntryMethod | null,
  opts: { knownVehicle?: boolean } = {}
): EntryStep {
  const steps = entryStepLabels(method, opts)
  const index = steps.findIndex((s) => s.id === current)
  if (index <= 0) return "method"
  return steps[index - 1].id
}
