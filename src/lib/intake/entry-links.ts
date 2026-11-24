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

export function newIntakeHref(prefill: { customerId?: string | null; vehicleId?: string | null } = {}): string {
  const params = new URLSearchParams({ entry: NEW_INTAKE_ENTRY })
  if (prefill.vehicleId) params.set("vehicleId", prefill.vehicleId)
  if (prefill.customerId) params.set("customerId", prefill.customerId)
  return `/orders/new?${params.toString()}`
}

export const NEW_INTAKE_HREF = newIntakeHref()
