import { flattenCategoryLeaves } from "./tree"
import type { CategoryNode } from "./types"

/**
 * Teyit anında öncelikli indirilecek yaygın bakım kategorileri — küçük-harf isim
 * parçaları. Kategori ağacı araca göre değiştiği (ör. dizel araçta "Ateşleme
 * bobini" yok) ve evrensel categoryId tahmini riskli olduğu için ID yerine
 * PROVIDER kategori ADIYLA eşleştiririz (fixture canlı endpoint çıktısıdır,
 * adlar tutarlı). Eşleşmeyen kategori sessizce lazy-picker'a düşer — asla
 * yanlış veri değil. Türkçe küçük-harf ("tr-TR") ile karşılaştırılır.
 */
export const COMMON_CATEGORY_MATCHERS: readonly string[] = [
  "fren balata",
  "fren disk",
  "fren kaliper",
  "fren hidro",
  "fren hortum",
  "el fren",
  "ana fren silindir",
  "fren servo",
  "yağ filtre",
  "hava filtre", // "hava filtresi" + "araç içi hava filtresi" (polen) ikisini de yakalar
  "yakıt filtre",
  "filtre takım",
  "kurum filtre",
  "triger",
  "v kayış",
  "kayış geric",
  "kayış kasna",
  "buji", // "buji" + "kızdırma bujisi"
  "ateşleme bobin",
  "akü",
  "silecek",
  "debriyaj",
  "amortisör",
  "rot",
  "salıncak",
  "termostat",
  "su pompas",
  "radyat",
  "direksiyon",
  "marş motor",
  "alternatör",
  "karter conta",
  "silindir kapağı conta",
  "enjektör",
]

/**
 * Aracın kategori ağacındaki yaprak kategorilerden, adı bir yaygın-bakım
 * matcher'ını içerenlerin id'leri (deduplike). SAF — I/O yok, test edilebilir.
 */
export function selectPrefetchTargets(tree: CategoryNode[]): number[] {
  const ids = new Set<number>()
  for (const leaf of flattenCategoryLeaves(tree)) {
    const name = leaf.name.toLocaleLowerCase("tr-TR")
    if (COMMON_CATEGORY_MATCHERS.some((m) => name.includes(m))) {
      ids.add(leaf.id)
    }
  }
  return [...ids]
}
