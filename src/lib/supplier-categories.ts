/** Tedarikçi ürün/hizmet kategorileri — çoklu seçim (bir firma birden fazla kategoride tedarik edebilir).
 *  Türkçe alfabetik sıra, "Diğer" en sonda. Serbest-metin legacy değerler seçicide korunur. */
export const SUPPLIER_CATEGORIES = [
  "Akü",
  "Cam",
  "Ekipman & Takım",
  "Elektrik & Elektronik",
  "Filtre",
  "Fren & Balata",
  "Hizmet & Taşeron",
  "Kaporta & Boya",
  "Lastik & Jant",
  "Motor & Şanzıman",
  "Sarf Malzeme",
  "Süspansiyon",
  "Yağ & Kimyasal",
  "Yedek Parça",
  "Diğer",
] as const

export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number]

/** Serbest arama terimiyle eşleşen kanonik kategoriler (dizi kolonda `contains` yok → `hasSome` için).
 *  Not: migration ile taşınan legacy serbest-metin kategoriler bu listede olmadığı için arama ile bulunmaz. */
export function matchingSupplierCategories(q: string): string[] {
  const needle = q.trim().toLocaleLowerCase("tr")
  if (!needle) return []
  return SUPPLIER_CATEGORIES.filter((c) => c.toLocaleLowerCase("tr").includes(needle))
}

/** Kayıtlı (muhtemelen legacy serbest-metin) değerleri kanonik listeyle birleştirir — seçici hiçbir değeri düşürmez. */
export function supplierCategoryItems(selected: string[]): string[] {
  const canonical = SUPPLIER_CATEGORIES as readonly string[]
  const extras = selected.filter((c) => c && !canonical.includes(c))
  return [...extras, ...canonical]
}
