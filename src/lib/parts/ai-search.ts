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

export type AiPartSearchPlan = {
  query: string
  brand: string | null
  limit: number
}

export function normalizeAiPartSearchPlan(
  input: { query?: unknown; brand?: unknown; limit?: unknown },
  fallback: string,
): AiPartSearchPlan {
  const brand = typeof input.brand === "string"
    ? input.brand.trim().replace(/\s+/g, " ").slice(0, 80) || null
    : null
  const requestedLimit = typeof input.limit === "number" ? Math.floor(input.limit) : 5
  return {
    query: normalizeAiSearchQuery(input.query, fallback),
    brand,
    limit: Math.max(1, Math.min(requestedLimit, 5)),
  }
}

export function aiPartCatalogQuery(plan: AiPartSearchPlan): string {
  return [plan.brand, plan.query].filter(Boolean).join(" ")
}

export function aiPartSearchAllowedRole(role: string): boolean {
  return role === "owner" || role === "usta"
}

export function normalizeAiSearchQuery(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback.trim().slice(0, 120)
  const query = value.trim().replace(/\s+/g, " ")
  return (query || fallback.trim()).slice(0, 120)
}

/**
 * Mock sağlayıcı da uçtan uca kullanılabildiği için yalnız girdiyi yankılamaz.
 * Gerçek modelin tool çağrısında yaptığı en temel işi deterministik biçimde
 * taklit eder: konuşma kalıplarını atıp katalogda bulunabilecek parça terimini
 * bırakır. Bu bir katalog araması değildir; yalnız mock query planner'dır.
 */
export function mockAiPartSearchQuery(message: string): string {
  const stripped = message
    .trim()
    .replace(/^(?:merhaba[,!]?\s*)?(?:bana\s+)?(?:bu\s+)?(?:araç|araba|otomobil)(?:ım|im|um|üm)?\s+(?:için\s+)?/i, "")
    .replace(/^(?:bana\s+)?/i, "")
    .replace(/\s+(?:arıyorum|arayabilir\s+misin|bulabilir\s+misin|bulur\s+musun|bul|lazım|gerekiyor)[.!?\s]*$/i, "")
  return normalizeAiSearchQuery(stripped, message)
}
