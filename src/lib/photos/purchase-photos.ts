import { resolvePhotoSrc } from "@/lib/photos/photo-src"

export type PurchasePhotoInput = {
  id: string
  fileUrl: string | null
  note: string | null
  serviceOrderItemId: string | null
}

/** Kaleme bağlı, gerçekten gösterilebilen bir dış alım karesi. */
export type PurchasePhoto = {
  id: string
  note: string | null
  /** `/api/photos?id=` proxy adresi (ya da mock'ta `data:`) — ham `fileUrl` DEĞİL. */
  src: string
}

/**
 * Dış alım fotoğraflarını ait oldukları iş emri kalemine göre gruplar (BAK-111).
 *
 * İki şey bilerek burada yapılır, çağıranda değil:
 *
 * 1. Kaynak `resolvePhotoSrc` ile çözülür. `VehiclePhoto.fileUrl` bir servis
 *    adresi değildir; doğrudan `<img src>` verilirse üretimde 403 döner ve fark
 *    yerelde (mock `data:` URL'i) hiç görünmez.
 * 2. Dosyası olmayan kayıt gruba HİÇ girmez. Böylece "fotoğrafı olan kalem"
 *    sorusunun cevabı tek yerde belirlenir: haritada anahtarı olmayan kalem
 *    hiç görsel alanı açmaz, yani kırık ikon ya da boş kutu oluşmaz.
 *
 * Soft-delete filtresi (`VISIBLE_PHOTO`) sunucu sorgusunda uygulanır; buraya
 * silinmiş kare zaten gelmez.
 */
export function groupPurchasePhotos(photos: PurchasePhotoInput[]): Map<string, PurchasePhoto[]> {
  const byItem = new Map<string, PurchasePhoto[]>()

  for (const photo of photos) {
    const itemId = photo.serviceOrderItemId
    if (!itemId) continue

    const src = resolvePhotoSrc(photo)
    if (!src) continue

    const entry: PurchasePhoto = { id: photo.id, note: photo.note, src }
    const existing = byItem.get(itemId)
    if (existing) existing.push(entry)
    else byItem.set(itemId, [entry])
  }

  return byItem
}
