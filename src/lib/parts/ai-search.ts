export type AiPartSuggestion = {
  key: string
  source: "stock" | "tecdoc" | "bakimx" | "getirbakim"
  sourceLabel: string
  name: string
  sku: string | null
  brand: string | null
  stockLabel: string | null
  priceKurus: number | null
  partId?: string
  tecdocArticleId?: number
  bakimxProductId?: string
  getirbakimProductId?: string
}

export function aiPartSearchAllowedRole(role: string): boolean {
  return role === "owner" || role === "usta"
}

export function normalizeAiSearchQuery(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback.trim().slice(0, 120)
  const query = value.trim().replace(/\s+/g, " ")
  return (query || fallback.trim()).slice(0, 120)
}
