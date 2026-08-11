import { normalizePartSearchTerm } from "@/lib/tr-search"
import type { ArticleOem } from "./types"

/** `tecdoc_article_oems` satırı — DB'ye yazılmaya hazır hâl. */
export interface ArticleOemRow {
  tecdocArticleId: number
  brand: string
  oemNo: string
  searchKey: string
}

/**
 * Tek parçanın OEM numaralarını aranabilir satırlara çevirir (SAF — I/O yok).
 *
 * - `searchKey` sorgu tarafıyla AYNI fonksiyondan üretilir (`normalizePartSearchTerm`),
 *   böylece "KK2Q-6C301-CA" kaydı "kk2q 6c301 ca" yazan kullanıcıyla eşleşir.
 * - Anahtarı boşa inen numara (yalnız ayraç/harf-olmayan karakter) atılır: aramada
 *   `%%` her satırla eşleşirdi.
 * - Aynı numara birden çok marka altında tekrar edebiliyor; unique anahtar
 *   (parça, numara) olduğu için ilk marka temsilci seçilir.
 */
export function buildArticleOemRows(tecdocArticleId: number, oems: ArticleOem[]): ArticleOemRow[] {
  const byNumber = new Map<string, ArticleOemRow>()
  for (const oem of oems) {
    const oemNo = oem.number.trim()
    if (!oemNo) continue
    const searchKey = normalizePartSearchTerm(oemNo)
    if (!searchKey) continue
    if (byNumber.has(oemNo)) continue
    byNumber.set(oemNo, { tecdocArticleId, brand: oem.brand.trim(), oemNo, searchKey })
  }
  return [...byNumber.values()]
}
