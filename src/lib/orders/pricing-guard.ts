/**
 * Teslim öncesi fiyat bütünlüğü kuralı.
 *
 * Teslimden sonra iş emri kompozisyonu kilitlenir (bkz. `isOrderLocked`), yani
 * fiyat bir daha girilemez: eksik tutar kalıcı olur, tahsilat ve müşteri bakiyesi
 * yanlış kalır. Bu yüzden fiyatı hiç girilmemiş kalem varken araç teslim edilemez.
 *
 * `unitPrice === null` "fiyat hiç girilmedi" demektir (arayüzde `—`); `0` ise
 * bilinçli girilmiş geçerli bir fiyattır (garanti/bedelsiz kalem) ve engellemez.
 * Kalem tipi (part/labor/external_labor) ayrımı yoktur — üçü de fiyatsız olabilir.
 *
 * Kural sunucu ve arayüzde ayrı ayrı yazılmasın diye tek kaynak burasıdır.
 */

export type PriceableItem = { id: string; name: string; unitPrice: number | null }

/** Fiyatı hiç girilmemiş kalemler, listedeki sıralarını koruyarak. */
export function findUnpricedItems<T extends PriceableItem>(items: readonly T[]): T[] {
  return items.filter((i) => i.unitPrice == null)
}

/** İlk iki ismi yazıp kalanı sayan kullanıcıya dönük hata metni. */
export function unpricedItemsMessage(items: readonly PriceableItem[]): string {
  const names = items.map((i) => i.name)
  const shown = names.slice(0, 2).join(", ")
  const rest = names.length - 2
  const list = rest > 0 ? `${shown} (+${rest})` : shown
  return `Fiyatı girilmemiş kalemler var: ${list}. Teslim öncesi tüm kalemlere fiyat girin (0 TL girilebilir).`
}
