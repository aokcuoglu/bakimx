/**
 * Çoklu fotoğraf seçiminin saf (DOM'suz) kuralları.
 *
 * Kullanıcı kamera ve galeri girdilerinden arka arkaya seçim yapabildiği için
 * seçim listesi *biriktirilir*: her yeni seçim mevcut listenin üzerine eklenir.
 * Aynı dosyanın iki kez eklenmesini ve tek seferde aşırı büyük bir kuyruk
 * oluşmasını burada engelliyoruz; önizleme URL'i yalnız kabul edilen dosyalar
 * için üretilsin diye bileşen `accepted` üzerinde döner (aksi halde reddedilen
 * dosyaların blob URL'leri sızardı).
 */

import { MAX_BATCH_PHOTOS } from "@/lib/photos/limits"

/** Tek seferde kuyruğa alınabilecek azami fotoğraf sayısı. */
export { MAX_BATCH_PHOTOS }

export type PhotoSelection = {
  /** Listeye eklenecek dosyalar (sıra korunur). */
  accepted: File[]
  /** Zaten seçili olduğu için atlanan dosya sayısı. */
  duplicates: number
  /** Limit dolduğu için atlanan dosya sayısı. */
  overflow: number
}

/** İki dosyayı aynı kabul etme ölçütü (File nesnesi kimliği yeniden seçimde değişir). */
function fileKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

/**
 * `current` listesine `incoming` dosyalarını ekler; yinelenenleri ve limiti
 * aşanları eler. Listeyi mutasyona uğratmaz.
 */
export function selectPhotoFiles(
  current: readonly File[],
  incoming: readonly File[],
  max: number = MAX_BATCH_PHOTOS,
): PhotoSelection {
  const seen = new Set(current.map(fileKey))
  const accepted: File[] = []
  let duplicates = 0
  let overflow = 0

  for (const file of incoming) {
    const key = fileKey(file)
    if (seen.has(key)) {
      duplicates++
      continue
    }
    if (current.length + accepted.length >= max) {
      overflow++
      continue
    }
    seen.add(key)
    accepted.push(file)
  }

  return { accepted, duplicates, overflow }
}

/** Toplu yüklemede kısmi başarısızlığı kullanıcıya tek cümlede anlatır. */
export function describeUploadFailure(failedNames: readonly string[], total: number): string {
  if (failedNames.length === 0) return ""
  const succeeded = total - failedNames.length
  const names = failedNames.slice(0, 3).join(", ")
  const more = failedNames.length > 3 ? ` ve ${failedNames.length - 3} dosya daha` : ""
  const prefix = succeeded > 0 ? `${succeeded} fotoğraf yüklendi. ` : ""
  return `${prefix}${failedNames.length} fotoğraf yüklenemedi: ${names}${more}. Tekrar deneyebilirsiniz.`
}
