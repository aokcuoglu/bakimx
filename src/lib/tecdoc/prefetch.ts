import { flattenCategoryLeaves } from "./tree"
import { getTecdocProvider } from "./provider"
import { getVehicleCategories, getArticlesByCategory } from "./catalog"
import { TecdocError } from "./types"
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

/**
 * Kayıt/güncelleme anında eager prefetch yapılmalı mı? Kullanıcı beklentisi:
 * "VIN teyit edildi ise" parçalar hazır olsun. Katalog-bağlı DEĞİLSE ya da VIN
 * teyitli DEĞİLSE null döner (o araçlar Parça sekmesi güvenlik ağıyla dolar,
 * boşuna RapidAPI kotası harcanmaz). SAF — I/O yok, test edilebilir.
 */
export function eagerPrefetchTarget(v: {
  catalogVehicleTypeId?: number | null
  vinConfirmed?: boolean | null
}): number | null {
  const id = v.catalogVehicleTypeId
  if (v.vinConfirmed === true && typeof id === "number" && Number.isInteger(id) && id > 0) {
    return id
  }
  return null
}

/**
 * Teyit sonrası arka planda (after()) çağrılır: aracın yaygın bakım kategorilerinin
 * parçalarını TecdocArticle cache'ine doldurur, böylece parça-ekleme UI'ı (ad
 * arama + marka/kategori) dolu cache'ten beslenir. HİÇBİR ZAMAN throw ETMEZ.
 *
 * - mock provider'da erken çıkar (mock persist etmez).
 * - getArticlesByCategory cache-first + idempotent (zaten cache'liyse API atlar).
 * - quota_exceeded'da döngü durur (kalan kotayı korur); diğer hatada kategori atlanır.
 */
export async function prefetchCommonVehicleParts(vehicleTypeId: number): Promise<void> {
  try {
    if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) return
    if (getTecdocProvider().name === "mock") return

    const tree = await getVehicleCategories(vehicleTypeId)
    const targets = selectPrefetchTargets(tree)

    for (const categoryId of targets) {
      try {
        await getArticlesByCategory(vehicleTypeId, categoryId)
      } catch (err) {
        if (err instanceof TecdocError && err.code === "quota_exceeded") {
          console.warn(`[tecdoc] prefetch durdu (kota): vehicleType=${vehicleTypeId}`)
          return
        }
        // tekil kategori hatası — atla, prefetch devam etsin
        console.warn(`[tecdoc] prefetch kategori atlandı ${categoryId}:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    // getVehicleCategories dahil her şeyi yut — arka plan görevi asla patlamamalı
    console.warn(`[tecdoc] prefetch başarısız vehicleType=${vehicleTypeId}:`, err instanceof Error ? err.message : err)
  }
}
