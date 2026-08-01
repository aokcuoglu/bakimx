/**
 * "Kalem eklendi" geri bildirim metni.
 *
 * Parça kutusunda Enter'a basınca kalem eklenir ve alan temizlenir; kutu
 * boşalınca kullanıcıda "ekledi mi, sildi mi?" belirsizliği kalıyordu
 * (issue #209). Ekleme sonrası gösterilen toast bu metni kullanır — kalemin
 * adını da içerir ki hangi kaydın listeye düştüğü belli olsun.
 *
 * Metin üretimi bileşenden ayrı tutulur: tür etiketi/kısaltma kuralı saf
 * fonksiyon olarak test edilebilir kalsın.
 */

export type AddedItemType = "part" | "labor" | "external_labor"

const TYPE_SUFFIX: Record<AddedItemType, string> = {
  part: "parçası eklendi",
  labor: "işçiliği eklendi",
  external_labor: "dış işçiliği eklendi",
}

/** Kalem tipi sunucu tarafında serbest `string`; bilinmeyen tip türsüz metne düşer. */
const FALLBACK_SUFFIX = "eklendi"

/** Toast tek satırda okunabilir kalsın: uzun katalog adları kırpılır. */
const MAX_NAME_LENGTH = 48

export function truncateItemName(name: string, max: number = MAX_NAME_LENGTH): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  // Kırpma sınırında kelimeyi ortadan bölmemeye çalış (son boşluğa kadar geri sar).
  const cut = trimmed.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.trimEnd()}…`
}

/**
 * Örn. `“Ön fren balatası” parçası eklendi`. Ad boşsa tür bazlı genel metne
 * düşer (ad zaten sunucuda zorunlu, bu yalnız savunma amaçlı).
 */
export function formatItemAddedMessage(type: AddedItemType | string, name: string): string {
  const clean = truncateItemName(name)
  const suffix = TYPE_SUFFIX[type as AddedItemType] ?? FALLBACK_SUFFIX
  if (!clean) return suffix.charAt(0).toUpperCase() + suffix.slice(1)
  return `“${clean}” ${suffix}`
}
