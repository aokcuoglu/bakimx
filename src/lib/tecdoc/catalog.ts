import { prisma } from "@/lib/db"
import { countRapidApiCallsThisMonth, rapidApiMonthlyCap } from "@/lib/rapidapi-quota"
import { getTecdocProvider } from "./provider"
import { dedupeBrands, normalizeArticles, normalizeCategories, normalizeSuppliers } from "./normalize"
import { TecdocError, TYPE_ID, LANG_ID, type ArticleSummary, type CategoryNode, type PartBrandSummary } from "./types"

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

  // First read normalized rows from DB — populated on first API fetch. Repeat
  // queries for the same (vehicleTypeId, categoryId) skip the paid RapidAPI call
  // (and even the raw JSON cache re-normalize) entirely. Mock provider never
  // persists rows (see write guard below), so skip the DB round-trip for it.
  if (provider.name !== "mock") {
    const rows = await prisma.tecdocArticle.findMany({ where: { vehicleTypeId: vehicleId, categoryId } })
    if (rows.length > 0) {
      return rows.map((r) => ({
        tecdocArticleId: r.tecdocArticleId,
        articleNo: r.articleNo,
        productName: r.productName,
        supplierName: r.supplierName,
        supplierId: r.supplierId,
        imageUrl: r.imageUrl,
      }))
    }
  }

  const raw = await cachedFetch(
    `articles:${TYPE_ID}:${vehicleId}:${categoryId}:${LANG_ID}`,
    "articles",
    provider.name,
    () => provider.getArticles(vehicleId, categoryId)
  )
  const articles = normalizeArticles(raw)

  // Persist normalized rows so the next read comes from DB directly. Mock data
  // must NOT be persisted (it would shadow real data after switching providers).
  // Wrapped in a single transaction so a mid-batch failure rolls back all rows
  // (avoids partial writes leaving the table in an inconsistent state).
  if (provider.name !== "mock" && articles.length > 0) {
    try {
      await prisma.$transaction(
        articles.map((a) =>
          prisma.tecdocArticle.upsert({
            where: {
              vehicleTypeId_categoryId_tecdocArticleId: {
                vehicleTypeId: vehicleId,
                categoryId,
                tecdocArticleId: a.tecdocArticleId,
              },
            },
            create: {
              vehicleTypeId: vehicleId,
              categoryId,
              tecdocArticleId: a.tecdocArticleId,
              articleNo: a.articleNo,
              productName: a.productName,
              supplierName: a.supplierName,
              supplierId: a.supplierId,
              imageUrl: a.imageUrl,
            },
            update: {
              articleNo: a.articleNo,
              productName: a.productName,
              supplierName: a.supplierName,
              supplierId: a.supplierId,
              imageUrl: a.imageUrl,
            },
          })
        )
      )
    } catch (err) {
      // DB write failure must not block the user from seeing API data.
      console.error("[tecdoc] article persist failed", err)
    }
  }

  return articles
}

/**
 * Parça markaları (TecDoc suppliers) — araç-bağımsız, tek sefer çekilir ve
 * cache'lenir. Cache key `suppliers:list` (vehicleId parametresi YOK). Mock
 * provider cachedFetch içinde cache'ye yazılmaz (mock→rapidapi geçişinde
 * gerçek veri gelir).
 */
export async function getPartBrands(): Promise<PartBrandSummary[]> {
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    "suppliers:list",
    "suppliers",
    provider.name,
    () => provider.getSuppliers()
  )
  return normalizeSuppliers(raw)
}

/**
 * Araç-scoped markalar — bu araç için cache'lenmiş TecdocArticle satırlarındaki
 * distinct supplier'lar. Kategori seçilmeden önce marka combobox'ını doldurur.
 * Best-effort: yalnız daha önce göz atılıp persist edilmiş kategoriler katkı verir.
 */
export async function getVehicleBrands(vehicleId: number): Promise<PartBrandSummary[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId },
    select: { supplierId: true, supplierName: true },
  })
  return dedupeBrands(rows)
}

/**
 * Kategori-scoped markalar — GÜVENİLİR yol. getArticlesByCategory o kategorinin
 * makalelerini (yoksa provider'dan çekip persist ederek) döner; distinct supplier.
 */
export async function getCategoryBrands(vehicleId: number, categoryId: number): Promise<PartBrandSummary[]> {
  const articles = await getArticlesByCategory(vehicleId, categoryId)
  return dedupeBrands(articles.map((a) => ({ supplierId: a.supplierId, supplierName: a.supplierName })))
}

/**
 * Bir markanın (supplierId) bu araç için cache'lenmiş makalelerinin bulunduğu
 * distinct categoryId'ler — best-effort marka→kategori filtresi. Sadece DB okur,
 * provider fetch YAPMAZ (eksik olabilir; kabul edilen davranış).
 */
export async function getBrandCategoryIds(vehicleId: number, supplierId: number): Promise<number[]> {
  if (
    !Number.isInteger(vehicleId) || vehicleId <= 0 ||
    !Number.isInteger(supplierId) || supplierId <= 0
  ) {
    throw new TecdocError("invalid_params", "Geçersiz katalog parametreleri.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId, supplierId },
    select: { categoryId: true },
    distinct: ["categoryId"],
  })
  return rows.map((r) => r.categoryId)
}
