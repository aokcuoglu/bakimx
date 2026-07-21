export type AttrOption = { id: number; label: string; sub?: string }

/**
 * Serbest "＋ ekle" aksiyonu gösterilsin mi ve hangi değeri commit etmeli.
 * - query boş/boşluk ise gösterme.
 * - zaten kayıtlı değere (currentValue, case-insensitive) eşitse gösterme
 *   (no-op PATCH önlenir).
 * - mevcut bir seçenekle (case-insensitive) birebir eşleşiyorsa gösterme
 *   (zaten listeden seçilebilir).
 * - aksi halde göster; commit değeri trim'li query.
 */
export function freeTextCommit(
  query: string,
  options: AttrOption[],
  currentValue = ""
): { show: boolean; value: string } {
  const value = query.trim()
  if (!value) return { show: false, value: "" }
  const lower = value.toLowerCase()
  // Zaten kayıtlı değere eşitse (serbest metin dahil) tekrar "＋ekle" önerme (no-op PATCH önlenir).
  if (currentValue.trim().toLowerCase() === lower) return { show: false, value }
  const exact = options.some((o) => o.label.toLowerCase() === lower)
  return { show: !exact, value }
}
