/**
 * Teknisyen ekranından fotoğraf ekleme için saf yardımcılar. Yükleme,
 * iş emri ekranıyla aynı sunucu yolunu kullanır (`/api/intakes/photos` →
 * addPhotoAction); burada yalnızca istemcinin gönderdiği veri hazırlanır ve
 * varsayılan aşama seçilir — böylece mantık UI'dan bağımsız test edilebilir.
 */

import { PHOTO_TYPES, type PhotoPhaseKey, type PhotoTypeKey } from "@/lib/constants"

/**
 * İş emrinin durumuna göre en olası fotoğraf aşaması. Teknisyen çoğu zaman
 * onarım sırasında fotoğraf çeker; kabul aşaması yalnızca iş başlamadan
 * önce, teslim aşaması ise iş bittikten sonra mantıklıdır.
 */
export function suggestPhotoPhase(orderStatus: string): PhotoPhaseKey {
  if (orderStatus === "completed" || orderStatus === "delivered") return "delivery"
  if (orderStatus === "in_progress" || orderStatus === "waiting_parts") return "repair_progress"
  return "intake"
}

/** Henüz çekilmemiş zorunlu fotoğraf türleri (KM, yakıt, dört yön …). */
export function missingRequiredPhotoTypes(existingTypes: string[]): PhotoTypeKey[] {
  const taken = new Set(existingTypes)
  return (Object.keys(PHOTO_TYPES) as PhotoTypeKey[]).filter(
    (key) => PHOTO_TYPES[key].required && !taken.has(key)
  )
}

export interface PhotoUploadInput {
  intakeFormId: string
  type: string
  phase: string
  note?: string
  file?: File | null
}

/**
 * Sunucunun beklediği alan adlarıyla FormData üretir. `label` her zaman
 * katalogdan türetilir; istemci serbest etiket göndermez.
 */
export function buildPhotoFormData(input: PhotoUploadInput): FormData {
  const fd = new FormData()
  fd.set("intakeFormId", input.intakeFormId)
  fd.set("type", input.type)
  fd.set("label", PHOTO_TYPES[input.type as PhotoTypeKey]?.label ?? input.type)
  fd.set("phase", input.phase)
  const note = input.note?.trim()
  if (note) fd.set("note", note)
  if (input.file) fd.set("file", input.file)
  return fd
}
