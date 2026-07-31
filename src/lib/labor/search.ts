/**
 * İşçilik kataloğu araması — Türkçe-duyarlı, aksansız, büyük/küçük harf duyarsız.
 * Liste sayfası, iş emri composer'ı ve teklif formu aynı fonksiyonu kullanır ki
 * "değişim" yazan da "degisim" yazan da aynı sonucu görsün.
 */

/** Küçült + yaygın TR diakritiklerini sadeleştir. */
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
}

/** Ad, kod ve kategoride alt-dize filtresi. Boş/whitespace sorgu → tüm liste. */
export function searchLaborItems<T extends { name: string; code?: string | null; category?: string | null }>(
  items: readonly T[],
  query: string
): T[] {
  const q = foldTr(query.trim())
  if (!q) return [...items]
  return items.filter((i) => foldTr(`${i.name} ${i.code ?? ""} ${i.category ?? ""}`).includes(q))
}
