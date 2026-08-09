/**
 * Randevu formundaki müşteri → araç seçim mantığı.
 *
 * Randevu ekranı müşteriyi sunucu tarafı aramayla seçer (bkz.
 * `CustomerSearchOrCreate`); araç listesi de o müşteriye ait olanlarla sınırlı
 * olarak `/api/vehicles?customerId=` üzerinden gelir — atölye izolasyonu uç
 * noktanın kendi oturumundan (`requireAuth`) gelir, istemciden gelen bir
 * workshop parametresi yoktur.
 */

export type VehicleChoice = {
  id: string
  plate: string
  brand: string
  model: string
}

/** Listede ve seçili değerde aynı etiketi üretir: "34 MYL 739 — Renault Megane". */
export function vehicleChoiceLabel(v: VehicleChoice): string {
  const tail = `${v.brand} ${v.model}`.trim()
  return tail ? `${v.plate} — ${tail}` : v.plate
}

/** `/api/vehicles` cevabındaki (şekli garanti olmayan) JSON'ı seçenek listesine indirger. */
export function toVehicleChoices(data: unknown): VehicleChoice[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .filter((v) => typeof v.id === "string" && v.id.length > 0)
    .map((v) => ({
      id: String(v.id),
      plate: typeof v.plate === "string" ? v.plate : "",
      brand: typeof v.brand === "string" ? v.brand : "",
      model: typeof v.model === "string" ? v.model : "",
    }))
}

/**
 * Yüklenen listede karşılığı olmayan araç seçimini temizler. Müşteri değişince
 * eski müşterinin aracı forma asılı kalmamalı — sunucu action'ı zaten araç ile
 * müşteriyi eşleştirmeyen kaydı reddeder, bu da kullanıcıyı o hataya düşürmemek
 * içindir.
 */
export function reconcileVehicleId(vehicleId: string, vehicles: VehicleChoice[]): string {
  if (!vehicleId) return ""
  return vehicles.some((v) => v.id === vehicleId) ? vehicleId : ""
}

/** Yeni oluşturulan aracı listenin başına ekler (zaten varsa listeyi değiştirmez). */
export function withVehicle(vehicles: VehicleChoice[], created: VehicleChoice): VehicleChoice[] {
  return vehicles.some((v) => v.id === created.id) ? vehicles : [created, ...vehicles]
}

/** Seçili müşterinin araçları. Hata/yetkisiz cevapta boş liste döner. */
export async function fetchCustomerVehicles(customerId: string): Promise<VehicleChoice[]> {
  if (!customerId) return []
  try {
    const res = await fetch(`/api/vehicles?customerId=${encodeURIComponent(customerId)}`)
    if (!res.ok) return []
    return toVehicleChoices(await res.json())
  } catch {
    return []
  }
}
