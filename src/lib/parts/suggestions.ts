import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"
import {
  getirbakimFitLevel,
  getirbakimMatchesVehicle,
  sortGetirbakimByFit,
} from "@/lib/parts/getirbakim/fitment"

/**
 * Parça arama açılır listesinin satırları.
 *
 * Dört kaynak var ve karışmaları tehlikeli:
 *   - `catalog`: TecDoc araması `vehicle_type_id` ile scope'lu → sonuç ARACA UYGUN.
 *   - `bakimx` : BakımX'in kendi ürün kataloğu (BAK-35). Araçtan BAĞIMSIZ (Faz 1'de
 *     yalnız `universal` ürünler yayınlanıyor), o yüzden araç kataloğa bağlı
 *     olmasa da aranabilir. Fiyatı atölyenin ALIŞ fiyatıdır.
 *   - `getirbakim`: GetirBakım ticari kataloğu (fiyat/stok). Araç verilince satır
 *     uyum seviyesi taşır (tam / muhtemel / bilinmiyor, #755); uymayanlar da listelenir.
 *   - `stock`  : atölyenin kendi stok kartları, araca bağlı DEĞİL → uyarıyla gösterilir (#181)
 *     ve eklenmeden önce onay istenir (#157).
 *
 * Stok kartı seçilirse kalem `partId` ile bağlanır ve stok düşümü tetiklenir;
 * katalog ve BakımX sonuçlarında böyle bir bağ yoktur (BakımX stoğu atölyenin
 * stoğu değildir — bkz. bakimx-item.ts).
 */

export interface StockPartLite {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  brand: string | null
  stockQty: number
  unit: string
  salePrice: number | null
}

export type PartSuggestion =
  | { kind: "catalog"; article: ArticleSearchResult }
  | { kind: "bakimx"; product: BakimxProductSummary }
  | { kind: "getirbakim"; product: GetirbakimProduct }
  | { kind: "stock"; part: StockPartLite }

/**
 * Satırın bu araca uygun olduğu DOĞRULANMIŞ mı? TecDoc araması araca scope'lu;
 * GetirBakım satırı yalnız tam araç tipi doğrulandıysa (`CONFIRMED`) sayılır (#755).
 */
export function suggestionFitsVehicle(s: PartSuggestion): boolean {
  if (s.kind === "catalog") return true
  return s.kind === "getirbakim" && getirbakimFitLevel(s.product) === "guaranteed"
}

/**
 * "Yalnız bu araca uyanlar" süzgecinde kalır mı? Doğrulanmış uyuma ek olarak
 * GetirBakım'ın model düzeyindeki "muhtemelen uyumlu" satırları da kalır — rozet
 * farkı satırda görünür. BakımX (araçtan bağımsız) ve stok kartları elenir.
 */
export function suggestionMatchesVehicle(s: PartSuggestion): boolean {
  if (s.kind === "catalog") return true
  return s.kind === "getirbakim" && getirbakimMatchesVehicle(s.product)
}

/** Base UI Autocomplete'in metin karşılığı — dört kaynak için tek yer. */
export function suggestionLabel(s: PartSuggestion): string {
  if (s.kind === "catalog") return s.article.productName
  if (s.kind === "bakimx" || s.kind === "getirbakim") return s.product.name
  return s.part.name
}

/** Liste anahtarı; kaynakların kimlikleri çakışmasın diye ön ek taşır. */
export function suggestionKey(s: PartSuggestion): string {
  if (s.kind === "catalog") return `c-${s.article.tecdocArticleId}`
  if (s.kind === "bakimx") return `b-${s.product.id}`
  if (s.kind === "getirbakim") return `g-${s.product.id}`
  return `s-${s.part.id}`
}

/**
 * Sıra (#755): GetirBakım (araca tam/muhtemel uyan) → TecDoc → BakımX →
 * GetirBakım (diğerleri) → atölye stoğu.
 *
 * Araca uyan GetirBakım satırları EN ÖNDE: hem araca uyumu doğrulanmış (ya da
 * model düzeyinde olası) hem de fiyatı/stoku olan, doğrudan kaleme yazılabilen
 * tek kaynak — vitrin arama kutusundaki "uyanlar önce" deneyimi. TecDoc
 * sonuçları araca scope'lu olduğu için hemen arkasında gelir. BakımX ürünleri
 * araçtan bağımsızdır ama satılabilirliği ve fiyatı bizde kayıtlıdır. Araca
 * uymayan (ya da uyumu bilinmeyen) GetirBakım ürünleri ELENMEZ — her parça
 * aranabilir kalmalı. Stok kartları en sonda, uyarıyla listelenir.
 *
 * GetirBakım grubu içinde sıra: tam uyumlu → muhtemelen uyumlu → diğerleri,
 * her seviyede GetirBakım'ın alaka sırası korunur.
 *
 * Aynı parça iki kaynakta birden çıkabilir (atölye kataloğa da giren bir parçayı
 * stok kartı olarak da tutuyorsa). Bu durumda stok satırı elenir — katalog satırı
 * hem araca uygunluğu doğrulanmış hem de daha zengin bilgi taşır; BakımX satırı
 * ise güncel alış fiyatını taşır. Eşleştirme parça numarası üzerinden yapılır
 * (SKU ya da OEM), boşluk/harf-durumu duyarsız.
 *
 * TecDoc ↔ BakımX arasında tekilleştirme YAPILMAZ: ikisi farklı teklif (biri
 * "araca uyuyor" bilgisi, diğeri "bizden şu fiyata alınır"), aynı parça numarası
 * çıksa bile kullanıcı ikisini de görmeli.
 */
export function buildPartSuggestions(
  articles: ArticleSearchResult[],
  bakimxProducts: BakimxProductSummary[],
  stockParts: StockPartLite[],
  getirbakimProducts: GetirbakimProduct[] = [],
): PartSuggestion[] {
  const cataloged = new Set(
    [
      ...articles.map((a) => a.articleNo),
      ...bakimxProducts.map((p) => p.sku),
    ]
      .map(normalizePartNo)
      .filter(Boolean)
  )
  const stock = stockParts.filter((p) => {
    const candidates = [p.sku, p.oemNo].map(normalizePartNo).filter(Boolean)
    return !candidates.some((n) => cataloged.has(n))
  })
  const getirbakim = sortGetirbakimByFit(getirbakimProducts)
  const getirbakimRow = (product: GetirbakimProduct): PartSuggestion => ({ kind: "getirbakim", product })
  return [
    ...getirbakim.filter(getirbakimMatchesVehicle).map(getirbakimRow),
    ...articles.map((article): PartSuggestion => ({ kind: "catalog", article })),
    ...bakimxProducts.map((product): PartSuggestion => ({ kind: "bakimx", product })),
    ...getirbakim.filter((product) => !getirbakimMatchesVehicle(product)).map(getirbakimRow),
    ...stock.map((part): PartSuggestion => ({ kind: "stock", part })),
  ]
}

/** "C 27 125" ↔ "c27125" aynı parçadır; ayraç ve harf durumu elenir. */
export function normalizePartNo(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
