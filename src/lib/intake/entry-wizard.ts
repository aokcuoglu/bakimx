/**
 * Kabul sihirbazının "araç girişi" bölümünün saf akış mantığı (#309).
 *
 * Kullanıcı önce bir yöntem seçer (ruhsat görseli / camdan şase / plaka ile ara /
 * müşteri ile ara); sihirbazın kaç adımdan oluştuğu ve adım etiketleri bu seçime
 * göre değişir. Karar mantığı bileşenden ayrı tutuldu ki adım rayı ile gerçek akış
 * asla ayrışmasın ve testlenebilsin.
 */

import { normalizePhone, normalizePlate } from "@/lib/format"
import { parsePlateFromText } from "@/lib/ocr/plate"
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

/**
 * URL'den gelen başlangıç yöntemi (`/orders/new?entry=plate`). Bilinmeyen ya da
 * boş değer `null` döner — sihirbaz o zaman her zamanki gibi yöntem seçimiyle
 * açılır.
 */
export function parseEntryMethod(raw: string | string[] | undefined): EntryMethod | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return ENTRY_METHODS.some((m) => m.value === value) ? (value as EntryMethod) : null
}

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
 * Odaklı plaka akışında araç bilgileri ekranının müşteri kartı. Plaka kayıtlı
 * değilse boş gelir ve yeni müşteri açılır; kayıtlıysa aracın sahibiyle dolu
 * gelir ve düzenlenirse o müşteri kaydı güncellenir (sahip değişmez).
 *
 * Bireyselde ad ve soyad TEK alandır (`name`, "Ad Soyad"); kaydederken
 * `splitPersonName` ile ayrılır. `type` kayıtlı müşteriden gelir: kurumsal
 * sahipte firma adı düzenlenir. Yeni müşteri bu kısa formda bireyseldir
 * (ruhsattan kurumsal sahip okunmadıkça).
 */
export type OwnerFields = {
  type: "individual" | "corporate"
  /** Bireysel: "Ad Soyad" tek alanda. */
  name: string
  companyName: string
  phone: string
}

export const EMPTY_OWNER_FIELDS: OwnerFields = {
  type: "individual",
  name: "",
  companyName: "",
  phone: "",
}

/**
 * "Ad Soyad" alanını yapısal ada böler: son kelime soyad, öncesi ad
 * ("AYŞE NUR KAYA" → ad "AYŞE NUR", soyad "KAYA"). Tek kelimede soyad boştur.
 */
export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] }
}

/** Kayıtlı müşteriden kart alanları. Tam ad yoksa ad + soyad birleştirilir. */
export function ownerFieldsFromCustomer(c: {
  type: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  phone: string
}): OwnerFields {
  if (c.type === "corporate") {
    return { type: "corporate", name: "", companyName: (c.companyName || "").trim(), phone: c.phone || "" }
  }
  const name = (c.fullName || "").trim() || [c.firstName, c.lastName].map((x) => (x || "").trim()).filter(Boolean).join(" ")
  return { type: "individual", name, companyName: "", phone: c.phone || "" }
}

/** Zorunlu müşteri alanları eksikse Türkçe hata metni, tamamsa `null`. */
export function ownerFieldError(o: OwnerFields): string | null {
  const missing: string[] = []
  if (o.type === "corporate") {
    if (!o.companyName.trim()) missing.push("Firma adı")
  } else if (!o.name.trim()) {
    missing.push("Ad Soyad")
  }
  const phone = normalizePhone(o.phone)
  if (!phone) missing.push("Telefon")
  if (missing.length) return `${missing.join(", ")} zorunludur.`
  if (phone.length < 10) return "Geçerli bir telefon numarası girin (en az 10 hane)."
  return null
}

/**
 * Kart düzenlendi mi? Boşluk ve telefon biçimi (0 / +90 / boşluk) fark sayılmaz —
 * yalnız gerçek değişiklik müşteri kaydını günceller.
 */
export function ownerFieldsChanged(original: OwnerFields, current: OwnerFields): boolean {
  const text = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
  const norm = (o: OwnerFields) => [text(o.name), text(o.companyName), normalizePhone(o.phone)].join("\u0000")
  return norm(original) !== norm(current)
}

/** Kartta kullanıcının yazdığı bir şey var mı (ad, firma ya da telefon)? */
export function hasOwnerInput(o: OwnerFields): boolean {
  return !!(o.name.trim() || o.companyName.trim() || o.phone.trim())
}

/**
 * Araç fotoğrafı ile girilen plaka aynı araca mı ait? `photoPlate`, fotoğraftan
 * okunan plakadır (kompakt) — fotoğraf ve o sırada girilen müşteri bilgileri bu
 * araca aittir. Plaka sonradan değiştirilirse ikisi başka bir araca kalabilir:
 *
 * - `"match"`: fotoğraf yok ya da plaka aynı.
 * - `"typing"`: plaka farklı ama henüz tam bir TR plakası değil — uyarı yazarken
 *   titremesin diye gösterilmez, yine de kaydetme engellenir.
 * - `"mismatch"`: plaka farklı ve tam — kullanıcı "aynı araç mı" diye seçmeli.
 *
 * Plaka en sık okuma hatasını düzeltmek için değişir (aynı araç); bu yüzden
 * fotoğraf kendiliğinden silinmez, karar kullanıcıya bırakılır.
 */
export function photoPlateStatus(photoPlate: string | null, currentPlate: string): "match" | "typing" | "mismatch" {
  if (!photoPlate) return "match"
  const current = normalizePlate(currentPlate)
  if (current === photoPlate) return "match"
  return parsePlateFromText(current) === current ? "mismatch" : "typing"
}

/** Kartta gösterilen / sahip satırına yazılan ad. */
export function ownerLabel(o: OwnerFields): string {
  return (o.type === "corporate" ? o.companyName : o.name).trim().replace(/\s+/g, " ")
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
