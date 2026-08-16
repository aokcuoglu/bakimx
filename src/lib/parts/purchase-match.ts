import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import { normalizePartNo, type StockPartLite } from "@/lib/parts/suggestions"

/**
 * Dışarıdan alınan parçanın NUMARASINI bildiğimiz kataloglarla eşleştirir (BAK-84).
 *
 * Neden ayrı bir modül: `buildPartSuggestions` bir ARAMA listesi üretir — kullanıcı
 * yazdıkça daralan, alt-dize eşleşmesine dayanan öneriler. Burada üretilen şey bir
 * UYARI: "elindeki parça zaten katalogda var". Uyarı ancak BİREBİR numara eşleşmesi
 * üzerine kurulabilir; alt-dize eşleşmesi ("0986" → onlarca Bosch parçası) ustayı
 * yanlış parçaya bağlardı. Bu yüzden eşleşme ölçütü tek: numaraların ayraç-duyarsız
 * normalize hâli AYNI olmalı (`normalizePartNo`, "C 27 125" ↔ "c27125").
 *
 * Sıra `buildPartSuggestions` ile aynı mantıkta: önce araca uygunluğu doğrulanmış
 * TecDoc parçası, sonra BakımX ürünü, en sonda atölyenin kendi stok kartı.
 */

export type PurchaseMatch =
  | { kind: "catalog"; article: ArticleSearchResult }
  | { kind: "bakimx"; product: BakimxProductSummary }
  | { kind: "stock"; part: StockPartLite }

/** Parça numarası sayılabilecek en kısa giriş — "12" gibi girdiler sorgulanmaz. */
export const PURCHASE_MATCH_MIN_LEN = 3

/** Uyarı panelinde gösterilecek en fazla eşleşme; fazlası ustayı boğar. */
export const PURCHASE_MATCH_LIMIT = 5

/** Kaynağın taşıdığı bütün numaralardan biri sorguyla birebir aynı mı? */
function hasExactNumber(candidates: Array<string | null | undefined>, needle: string): boolean {
  const n = normalizePartNo(needle)
  if (n.length < PURCHASE_MATCH_MIN_LEN) return false
  return candidates.some((c) => {
    const v = normalizePartNo(c)
    return v.length > 0 && v === n
  })
}

/**
 * Numara birebir eşleşen kayıtları döndürür. Girdi kümeleri çağıranın elindeki
 * arama sonuçlarıdır (aynı uçlar: TecDoc araç kataloğu, BakımX, atölye stoğu) —
 * bu fonksiyon ağ bilmez, saf kalır ve test edilebilir.
 */
export function findPartNumberMatches(
  partNo: string,
  sources: {
    articles?: ArticleSearchResult[]
    bakimxProducts?: BakimxProductSummary[]
    stockParts?: StockPartLite[]
  },
): PurchaseMatch[] {
  const q = normalizePartNo(partNo)
  if (q.length < PURCHASE_MATCH_MIN_LEN) return []

  const catalog = (sources.articles ?? [])
    // OEM numarası da eşleşir: usta kutunun üstündeki OEM'i yazdığında da
    // "bu parça araca uyuyor" bilgisini görmeli (bkz. matchedOems, #312).
    .filter((a) => hasExactNumber([a.articleNo, ...a.matchedOems], partNo))
    .map((article): PurchaseMatch => ({ kind: "catalog", article }))

  const bakimx = (sources.bakimxProducts ?? [])
    .filter((p) => hasExactNumber([p.sku, p.barcode, ...p.oemNumbers], partNo))
    .map((product): PurchaseMatch => ({ kind: "bakimx", product }))

  // Katalogda/BakımX'te zaten çıkan numara stok kartı olarak tekrar gösterilmez —
  // aynı uyarı iki kez okunmasın (buildPartSuggestions ile aynı tekilleştirme).
  const covered = catalog.length > 0 || bakimx.length > 0
  const stock = covered
    ? []
    : (sources.stockParts ?? [])
        .filter((p) => hasExactNumber([p.sku, p.oemNo], partNo))
        .map((part): PurchaseMatch => ({ kind: "stock", part }))

  return [...catalog, ...bakimx, ...stock].slice(0, PURCHASE_MATCH_LIMIT)
}

/**
 * Eşleşmenin dış alım formuna yazacağı alanlar.
 *
 * `tecdocArticleId` YALNIZ TecDoc eşleşmesinde dolar — kalemdeki o kolon araç
 * kataloğu bağıdır. BakımX ve stok eşleşmelerinde kimlik bağı bilerek KURULMAZ:
 *   • `bakimxProductId` yazmak satırı `source=bakimx` sayılan bir kaleme çevirirdi
 *     (bkz. quotes/actions.ts, bakimx-item.ts) — oysa parça dışarıdan alındı.
 *   • `partId` yazmak stok DÜŞÜMÜ tetiklerdi (bkz. reserveStockInTx) — oysa parça
 *     atölye stoğundan çıkmadı.
 * Bu iki kaynakta eşleşme bilgilendirmedir: ad/numara/marka alanları dolar, kalem
 * yine serbest (manuel) dış alım olarak kaydedilir.
 */
export interface PurchaseMatchFields {
  name: string
  sku: string
  brand: string
  category: string
  categoryId: number | null
  tecdocArticleId: number | null
}

export function purchaseMatchFields(match: PurchaseMatch): PurchaseMatchFields {
  if (match.kind === "catalog") {
    const a = match.article
    return {
      name: a.productName,
      sku: a.articleNo,
      brand: a.supplierName || "",
      category: a.categoryName || "",
      categoryId: a.categoryId || null,
      tecdocArticleId: a.tecdocArticleId,
    }
  }
  if (match.kind === "bakimx") {
    const p = match.product
    return {
      name: p.name,
      sku: p.sku,
      brand: p.brandName || "",
      category: p.categoryLabel || "",
      categoryId: null,
      tecdocArticleId: null,
    }
  }
  const p = match.part
  return {
    name: p.name,
    sku: p.sku || p.oemNo || "",
    brand: p.brand || "",
    category: "",
    categoryId: null,
    tecdocArticleId: null,
  }
}

/** Uyarı panelindeki liste anahtarı — kaynaklar çakışmasın diye ön ekli. */
export function purchaseMatchKey(match: PurchaseMatch): string {
  if (match.kind === "catalog") return `c-${match.article.tecdocArticleId}`
  if (match.kind === "bakimx") return `b-${match.product.id}`
  return `s-${match.part.id}`
}

/** Eşleşmenin ustaya ne söylediği — kaynak başına tek cümle. */
export function purchaseMatchNote(match: PurchaseMatch): string {
  if (match.kind === "catalog") return "Bu araca uygun katalog parçası"
  if (match.kind === "bakimx") return "BakımX kataloğunda satılıyor — araca uygunluğu doğrulanmadı"
  return "Atölye stok kartınızda kayıtlı — araca bağlı değil"
}
