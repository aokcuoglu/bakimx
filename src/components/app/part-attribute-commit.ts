export type AttrOption = { id: number; label: string; sub?: string }

/**
 * Serbest "＋ ekle" aksiyonu gösterilsin mi ve hangi değeri commit etmeli.
 * - query boş/boşluk ise gösterme.
 * - mevcut bir seçenekle (Türkçe case-insensitive) birebir eşleşiyorsa gösterme
 *   (zaten listeden seçilebilir).
 * - aksi halde göster; commit değeri trim'li query.
 */
export function freeTextCommit(
  query: string,
  options: AttrOption[]
): { show: boolean; value: string } {
  const value = query.trim()
  if (!value) return { show: false, value: "" }
  const lower = value.toLocaleLowerCase("tr")
  const exact = options.some((o) => o.label.toLocaleLowerCase("tr") === lower)
  return { show: !exact, value }
}
