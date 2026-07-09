/**
 * İş emri parça satırının miktarı değiştiğinde stok mutabakatı için farkı hesaplar.
 * Yalnızca partId'ye bağlı (kendi stoğumuzdan) parça satırları için anlamlıdır.
 */
export function computeStockDelta(
  oldQty: number,
  newQty: number,
): { direction: "reserve" | "return" | "none"; amount: number } {
  const diff = newQty - oldQty
  if (diff > 0) return { direction: "reserve", amount: diff }
  if (diff < 0) return { direction: "return", amount: -diff }
  return { direction: "none", amount: 0 }
}
