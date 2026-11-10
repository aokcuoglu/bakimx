import type { UnifiedResult } from "@/lib/search/unified-results"

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"
const ORDER_SEARCH_ENDPOINT = "/api/search/orders"

export type OrderSearchResult = { id: string; label: string; sublabel: string }

/** Bir arama sonucunun gideceği detay sayfası URL'i. */
export function resultHref(result: UnifiedResult): string {
  return result.kind === "vehicle"
    ? `/vehicles/${result.vehicleId}`
    : `/customers/${result.customerId}`
}

/**
 * Birleşik araç/müşteri aramasını çağırır. Boş sorguda ağa çıkmaz; hata,
 * non-ok yanıt veya beklenmeyen gövdede sessizce `[]` döner (arama kutusu
 * çalışmaya devam etsin).
 */
export async function fetchGlobalSearchResults(query: string): Promise<UnifiedResult[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? (data.results as UnifiedResult[]) : []
  } catch {
    return []
  }
}

export async function fetchOrderSearchResults(query: string): Promise<OrderSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const res = await fetch(`${ORDER_SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? (data.results as OrderSearchResult[]) : []
  } catch {
    return []
  }
}
