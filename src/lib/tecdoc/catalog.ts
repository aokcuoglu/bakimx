import { prisma } from "@/lib/db"
import { countRapidApiCallsThisMonth, rapidApiMonthlyCap } from "@/lib/rapidapi-quota"
import { getTecdocProvider } from "./provider"
import { normalizeArticles, normalizeCategories } from "./normalize"
import { TecdocError, TYPE_ID, LANG_ID, type ArticleSummary, type CategoryNode } from "./types"

/**
 * Cache-first TecDoc reads, mirroring src/lib/vin/lookup.ts: each (endpoint,
 * params) combination hits the paid provider at most once ever; the raw
 * payload is cached and normalized on read (schema fixes never invalidate the
 * cache). Transport/shape errors are NOT cached so they stay retryable.
 */
async function cachedFetch(
  key: string,
  endpoint: string,
  providerName: string,
  fetcher: () => Promise<unknown>
): Promise<unknown> {
  // Mock responses are free and deterministic — never persist them, otherwise
  // they shadow real data for the same key after switching to rapidapi.
  if (providerName === "mock") return fetcher()

  const cached = await prisma.tecdocCache.findUnique({ where: { key } })
  if (cached) {
    prisma.tecdocCache
      .update({ where: { key }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only
    return cached.rawResponse
  }

  if ((await countRapidApiCallsThisMonth()) >= rapidApiMonthlyCap()) {
    throw new TecdocError("quota_exceeded", "Aylık katalog sorgu limiti doldu. Lütfen daha sonra tekrar deneyin.")
  }

  const raw = await fetcher()
  await prisma.tecdocCache.upsert({
    where: { key }, // upsert: concurrent first-fetches must not crash
    create: { key, endpoint, rawResponse: raw as object },
    update: { hitCount: { increment: 1 } },
  })
  return raw
}

export async function getVehicleCategories(vehicleId: number): Promise<CategoryNode[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    `categories:v2:${TYPE_ID}:${vehicleId}:${LANG_ID}`,
    "categories",
    provider.name,
    () => provider.getCategories(vehicleId)
  )
  return normalizeCategories(raw)
}

export async function getArticlesByCategory(vehicleId: number, categoryId: number): Promise<ArticleSummary[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz katalog parametreleri.")
  }
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    `articles:${TYPE_ID}:${vehicleId}:${categoryId}:${LANG_ID}`,
    "articles",
    provider.name,
    () => provider.getArticles(vehicleId, categoryId)
  )
  return normalizeArticles(raw)
}
