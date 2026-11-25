import type { EntryMethod } from "@/lib/intake/entry-wizard"

/**
 * Ofisteki "Yeni Araç Kabul" girişlerinin ortak hedefi (#813, #832).
 *
 * Her giriş kabulü doğrudan plaka kamerasıyla açar — teknisyen panelindeki
 * "Araç Kabul" kartıyla aynı odaklı akış. `from=technician` bilinçli olarak
 * YOK: ofis kabuğu (sidebar) kalır ve geri bağlantısı Araç Kabulleri'ne gider
 * (`orders/new/page.tsx`).
 *
 * Bağlam taşınır (#832): müşteriden açılınca `customerId` (yeni plakada sahip
 * kartı o müşteriyle dolu gelir), araçtan açılınca `vehicleId` (araç ve sahibi
 * yüklenir, kamera ön fotoğraf için açılır).
 */
const NEW_INTAKE_ENTRY: EntryMethod = "plate"

/**
 * Kabul adresi. `back`: kabulün açıldığı sayfa — geri bağlantısı oraya döner
 * (#842). Yalnız `parseIntakeBack`in kabul ettiği iç adresler yazılır; başka bir
 * değer (ör. "+" menüsünün açıldığı herhangi bir sayfa) sessizce düşer ve geri
 * bağlantısı varsayılana ("Araç Kabulleri") kalır.
 */
export function newIntakeHref(
  prefill: { customerId?: string | null; vehicleId?: string | null; back?: string | null } = {},
): string {
  const params = new URLSearchParams({ entry: NEW_INTAKE_ENTRY })
  if (prefill.vehicleId) params.set("vehicleId", prefill.vehicleId)
  if (prefill.customerId) params.set("customerId", prefill.customerId)
  if (prefill.back && parseIntakeBack(prefill.back)) params.set("back", prefill.back)
  return `/orders/new?${params.toString()}`
}

export const NEW_INTAKE_HREF = newIntakeHref()

/**
 * Kabul ekranının geri hedefi (#842). Yalnız uygulamanın bilinen sayfaları kabul
 * edilir — URL'den gelen değer olduğu için açık yönlendirmeye kapalı: tam eşleşen
 * liste sayfaları ya da `/customers|vehicles|reminders/<id>` biçimi. `//…`,
 * `https:`, `/api/…`, `..` ve sorgu dizesi reddedilir.
 *
 * Müşteri ve araçta etiket (ad / plaka) atölyeye göre süzülmüş veriden sayfada
 * çözülür; burada yalnız id döner.
 */
export type IntakeBackTarget =
  | { kind: "page"; href: string; label: string }
  | { kind: "customer"; href: string; id: string }
  | { kind: "vehicle"; href: string; id: string }

const BACK_PAGES = new Map<string, string>([
  ["/dashboard", "Genel Bakış"],
  ["/orders", "Araç Kabulleri"],
  ["/customers", "Müşteriler"],
  ["/vehicles", "Araçlar"],
  ["/quotes", "Teklifler"],
  ["/appointments", "Randevular"],
  ["/reminders", "Bakım Hatırlatmaları"],
])

const BACK_DETAIL = /^\/(customers|vehicles|reminders)\/([A-Za-z0-9_-]{1,64})$/

/** Kayıt sayfası değil, oluşturma ekranı olan alt yollar. */
const NON_RECORD_SEGMENTS = new Set(["new"])

export function parseIntakeBack(raw: string | string[] | null | undefined): IntakeBackTarget | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const page = BACK_PAGES.get(value)
  if (page) return { kind: "page", href: value, label: page }
  const match = BACK_DETAIL.exec(value)
  if (!match) return null
  const [, section, id] = match
  if (NON_RECORD_SEGMENTS.has(id)) return null
  if (section === "customers") return { kind: "customer", href: value, id }
  if (section === "vehicles") return { kind: "vehicle", href: value, id }
  return { kind: "page", href: value, label: "Bakım hatırlatması" }
}
