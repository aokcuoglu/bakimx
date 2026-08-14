import { normalizePartSearchTerm } from "@/lib/tr-search"

/**
 * BakımX katalog ürününün arama anahtarı (`bakimx_products.search_key`).
 *
 * NEDEN KOLON: BakımX ürünleri araçtan bağımsız ve global olduğu için TecDoc
 * aramasındaki `vehicle_type_id` ön-filtresi burada YOK — arama tüm katalog
 * üzerinde çalışır. Anahtar yazma anında (form + içe aktarım) üretilir, okuma
 * tarafı tek kolonda `contains` yapar; raw SQL fonksiyon çağrısına gerek kalmaz.
 *
 * KATLAMA: her parça `normalizePartSearchTerm`'den geçer — küçük harf, Türkçe /
 * aksanlı harfler ASCII'ye (FOLD_FROM/FOLD_TO), harf-rakam dışı her şey silinir.
 * Böylece "akü" ↔ "aku" ve "C 27 125" ↔ "c27125" aynı anahtara iner. Katlama
 * tablosu `tecdoc_article_oems.search_key` ve `searchVehicleArticles` ile ortak.
 *
 * AYRAÇ: parçalar TEK BOŞLUKLA birleştirilir. Sorgu terimleri de aynı
 * fonksiyondan geçtiği için hiçbir terim boşluk içeremez → boşluk, iki parçanın
 * sınırında yanlış eşleşmeyi ("Mutlu" + "Akü" → "mutluaku" içinde "luak")
 * engeller ama terim içi aramayı hiç kısıtlamaz.
 */
export type BakimxSearchKeyInput = {
  name: string
  brandName: string
  sku: string
  oemNumbers?: readonly string[] | null
}

export function buildBakimxProductSearchKey(input: BakimxSearchKeyInput): string {
  const parts = [input.name, input.brandName, input.sku, ...(input.oemNumbers ?? [])]
  const seen = new Set<string>()
  for (const part of parts) {
    const normalized = normalizePartSearchTerm(part ?? "")
    if (normalized) seen.add(normalized)
  }
  return [...seen].join(" ")
}

/**
 * Kullanıcı sorgusunu anahtarla aynı alfabeye indirger. Her terim ayrı ayrı
 * `contains` ile aranır (VE mantığı): "mutlu aku" hem markayı hem ürün adını
 * tutan satırı bulur, sıraları farklı olsa bile. Boş/anlamsız terimler düşer.
 */
export function bakimxProductSearchTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((term) => normalizePartSearchTerm(term))
    .filter(Boolean)
}

/** `bakimxProductSearchTerms` + `contains` eşleşmesinin bellek içi karşılığı (test/istemci tarafı). */
export function bakimxProductSearchKeyMatches(searchKey: string, query: string): boolean {
  const terms = bakimxProductSearchTerms(query)
  if (terms.length === 0) return true
  return terms.every((term) => searchKey.includes(term))
}
