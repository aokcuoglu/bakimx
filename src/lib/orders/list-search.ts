/** `/orders` adres çubuğu param'ları — saf, istemci paketine güvenle girer. */
export const ORDER_FILTER_FIELDS = ["q", "status", "payment", "technician", "invoice", "delivery"] as const

/**
 * Filtre formu değerlerini mevcut adrese uygular: boş değer param'ı kaldırır,
 * `view` gibi diğer param'lar korunur, `limit` ilk sayfaya döner.
 */
export function buildOrderFilterSearch(current: URLSearchParams, data: { get(name: string): unknown }): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const name of ORDER_FILTER_FIELDS) {
    const value = String(data.get(name) ?? "").trim()
    if (value) params.set(name, value)
    else params.delete(name)
  }
  params.delete("limit")
  return params
}

/** "Daha fazla yükle": yalnız `limit` değişir, diğer tüm param'lar (view dahil) korunur. */
export function buildOrderLoadMoreSearch(current: URLSearchParams, nextLimit: number): URLSearchParams {
  const params = new URLSearchParams(current)
  params.set("limit", String(nextLimit))
  return params
}
