import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"

/**
 * Parça arama açılır listesinin satırları.
 *
 * İki kaynak var ve karışmaları tehlikeli:
 *   - `catalog`: TecDoc araması `vehicle_type_id` ile scope'lu → sonuç ARACA UYGUN.
 *   - `stock`  : atölyenin kendi stok kartları, araca bağlı DEĞİL → uyarıyla gösterilir (#181)
 *     ve eklenmeden önce onay istenir (#157).
 *
 * Stok kartı seçilirse kalem `partId` ile bağlanır ve stok düşümü tetiklenir;
 * katalog sonucunda böyle bir bağ yoktur.
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
  | { kind: "stock"; part: StockPartLite }

/** Satırın bu araca uygun olduğu doğrulanmış mı? */
export function suggestionFitsVehicle(s: PartSuggestion): boolean {
  return s.kind === "catalog"
}

/** Base UI Autocomplete'in metin karşılığı — iki kaynak için tek yer. */
export function suggestionLabel(s: PartSuggestion): string {
  return s.kind === "catalog" ? s.article.productName : s.part.name
}

/** Liste anahtarı; iki kaynağın kimlikleri çakışmasın diye ön ek taşır. */
export function suggestionKey(s: PartSuggestion): string {
  return s.kind === "catalog" ? `c-${s.article.tecdocArticleId}` : `s-${s.part.id}`
}

/**
 * Katalog sonuçları ÖNCE gelir: araca uygunluğu doğrulanmış olan onlar, kullanıcı
 * önce onları görmeli. Stok kartları arkadan uyarıyla listelenir.
 *
 * Aynı parça iki kaynakta birden çıkabilir (atölye kataloğa da giren bir parçayı
 * stok kartı olarak da tutuyorsa). Bu durumda stok satırı elenir — katalog satırı
 * hem araca uygunluğu doğrulanmış hem de daha zengin bilgi taşır. Eşleştirme
 * parça numarası üzerinden yapılır (SKU ya da OEM), boşluk/harf-durumu duyarsız.
 */
export function buildPartSuggestions(
  articles: ArticleSearchResult[],
  stockParts: StockPartLite[]
): PartSuggestion[] {
  const catalogNumbers = new Set(
    articles.map((a) => normalizePartNo(a.articleNo)).filter(Boolean)
  )
  const stock = stockParts.filter((p) => {
    const candidates = [p.sku, p.oemNo].map(normalizePartNo).filter(Boolean)
    return !candidates.some((n) => catalogNumbers.has(n))
  })
  return [
    ...articles.map((article): PartSuggestion => ({ kind: "catalog", article })),
    ...stock.map((part): PartSuggestion => ({ kind: "stock", part })),
  ]
}

/** "C 27 125" ↔ "c27125" aynı parçadır; ayraç ve harf durumu elenir. */
function normalizePartNo(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
