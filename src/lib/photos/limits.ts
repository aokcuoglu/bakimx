/**
 * İş emri / kabul fotoğrafı yükleme limitleri.
 *
 * Sıkıştırma istemcide yapılır; sunucu hard limiti sıkıştırma sonrası boyuta
 * bakar. Adet kotası kötüye kullanımı keser — maliyet kontrolünün asıl kolu
 * sıkıştırmadır.
 */

/** Sunucu hard limiti (sıkıştırma sonrası). */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024

/** İstemcinin sıkıştırmaya almadan reddettiği ham üst sınır. */
export const MAX_RAW_INPUT_BYTES = 20 * 1024 * 1024

/** Uzun kenar üst sınırı (px). */
export const COMPRESS_MAX_EDGE = 2048

/** İlk JPEG kalitesi; hedef aşılırsa kademeli düşülür. */
export const COMPRESS_JPEG_QUALITY = 0.8

/** Sıkıştırma hedefi — mümkünse bu boyutun altında kal. */
export const COMPRESS_TARGET_BYTES = 1 * 1024 * 1024

/** Tek seferde galeri seçiminde kuyruğa alınabilecek azami kare. */
export const MAX_BATCH_PHOTOS = 3

/** Bir kabul/iş emri formunda aktif (silinmemiş) fotoğraf üst sınırı. */
export const MAX_ACTIVE_PHOTOS_PER_INTAKE = 30

export function maxFileSizeLabelMb(): string {
  return String(Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024)))
}
