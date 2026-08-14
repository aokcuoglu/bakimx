import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

/**
 * Parça arama açılır listesinin satırları.
 *
 * Üç kaynak var ve karışmaları tehlikeli:
 *   - `catalog`: TecDoc araması `vehicle_type_id` ile scope'lu → sonuç ARACA UYGUN.
 *   - `bakimx` : BakımX'in kendi ürün kataloğu (BAK-35). Araçtan BAĞIMSIZ (Faz 1'de
 *     yalnız `universal` ürünler yayınlanıyor), o yüzden araç kataloğa bağlı
 *     olmasa da aranabilir. Fiyatı atölyenin ALIŞ fiyatıdır.
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
  | { kind: "stock"; part: StockPartLite }

/** Satırın bu araca uygun olduğu doğrulanmış mı? */
export function suggestionFitsVehicle(s: PartSuggestion): boolean {
  return s.kind === "catalog"
}

/** Base UI Autocomplete'in metin karşılığı — üç kaynak için tek yer. */
export function suggestionLabel(s: PartSuggestion): string {
  if (s.kind === "catalog") return s.article.productName
  if (s.kind === "bakimx") return s.product.name
  return s.part.name
}

/** Liste anahtarı; kaynakların kimlikleri çakışmasın diye ön ek taşır. */
export function suggestionKey(s: PartSuggestion): string {
  if (s.kind === "catalog") return `c-${s.article.tecdocArticleId}`
  if (s.kind === "bakimx") return `b-${s.product.id}`
  return `s-${s.part.id}`
}

/**
 * Sıra: TecDoc → BakımX → atölye stoğu.
 *
 * Katalog sonuçları ÖNCE gelir: araca uygunluğu doğrulanmış olan onlar, kullanıcı
 * önce onları görmeli. BakımX ürünleri hemen arkasında gelir — araca uygunluğu
 * doğrulanmamıştır ama satılabilirliği ve fiyatı bizde kayıtlıdır. Stok kartları
 * en sonda, uyarıyla listelenir.
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
  stockParts: StockPartLite[]
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
  return [
    ...articles.map((article): PartSuggestion => ({ kind: "catalog", article })),
    ...bakimxProducts.map((product): PartSuggestion => ({ kind: "bakimx", product })),
    ...stock.map((part): PartSuggestion => ({ kind: "stock", part })),
  ]
}

/** "C 27 125" ↔ "c27125" aynı parçadır; ayraç ve harf durumu elenir. */
export function normalizePartNo(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
