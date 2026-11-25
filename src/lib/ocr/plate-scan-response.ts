/**
 * `/api/plate/scan` yanıt sözleşmesi (#840). Route'tan ayrıldı ki test edilebilsin.
 *
 * Normal çağrıda plaka okunamazsa 422 döner: kare plaka için yeniden çekilmeli
 * (TR akışı). `allowNoPlate` yalnız yabancı plakalı araçta araç fotoğrafı için
 * gönderilir — kamera ve okuma istemi yalnız TR plakası tanır (bilinçli, TR okuma
 * doğruluğuna dokunmamak için), bu yüzden yabancı araçta plaka okunmaz; kare ve
 * fotoğraftaki marka yine de kabul edilir.
 */

export const PLATE_UNREADABLE_MESSAGE =
  "Plaka okunamadı. Aracın önünü, plaka net görünecek şekilde biraz daha yakından çekin."

type ScanBody = { plate?: string; brand?: string; error?: string }

/** Okunan marka kataloğa eşlenmeli mi? Plaka okunmadıysa yalnız `allowNoPlate` ile. */
export function shouldMatchBrand(input: { plate: string | null; rawBrand: string; allowNoPlate: boolean }): boolean {
  return !!input.rawBrand.trim() && (!!input.plate || input.allowNoPlate)
}

export function plateScanResponse(input: {
  plate: string | null
  brand: string | null
  allowNoPlate: boolean
}): { status: 200 | 422; body: ScanBody } {
  const { plate, brand, allowNoPlate } = input
  if (!plate && !allowNoPlate) return { status: 422, body: { error: PLATE_UNREADABLE_MESSAGE } }
  const body: ScanBody = {}
  if (plate) body.plate = plate
  if (brand) body.brand = brand
  return { status: 200, body }
}
