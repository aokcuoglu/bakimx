import { z } from "zod"

/**
 * Schemas derived from REAL probed payloads (2026-07-02, vehicleId 134068 —
 * see fixtures/). Kept loose on purpose: the cache stores raw payloads and
 * normalization happens on read, so schema fixes never require cache
 * invalidation.
 *
 * Probe findings worth keeping:
 * - categories variant-2 returns `{categories: {"<name>": node}}` where node =
 *   {categoryId, categoryName, level, children} and `children` is either a
 *   name-keyed object map or an EMPTY ARRAY at leaves.
 * - POST /articles/list-articles is broken on this provider (always returns
 *   all-null fields, tried string and integer ids) — the GET legacy path form
 *   works and is what we use.
 * - No countryFilterId needed for either call.
 */

const categoryNodeRawSchema: z.ZodType<CategoryNodeRaw> = z.lazy(() =>
  z.object({
    categoryId: z.number(),
    categoryName: z.string(),
    children: z.union([z.record(z.string(), categoryNodeRawSchema), z.array(z.unknown())]).optional(),
  })
)

export interface CategoryNodeRaw {
  categoryId: number
  categoryName: string
  children?: Record<string, CategoryNodeRaw> | unknown[]
}

export const categoriesResponseSchema = z.object({
  categories: z.record(z.string(), categoryNodeRawSchema),
})

export const articleRawSchema = z.object({
  articleId: z.number(),
  articleNo: z.string(),
  supplierName: z.string().nullish(),
  supplierId: z.number().nullish(),
  articleProductName: z.string().nullish(),
  s3image: z.string().nullish(),
})

export const articlesResponseSchema = z.object({
  countArticles: z.number().nullish(),
  articles: z.array(articleRawSchema).nullish(),
})

export type ArticleRaw = z.infer<typeof articleRawSchema>

/**
 * Supplier (parça markası) raw schema — GET /suppliers/list top-level array
 * döndürür (nesne değil). Probed 2026-07-02: 1264 öğe, alanlar:
 * supplierId, supplierName, supplierMatchCode (opsiyonel), supplierLogoName
 * (opsiyonel), s3image (opsiyonel).
 */
export const supplierRawSchema = z.object({
  supplierId: z.number(),
  supplierName: z.string(),
  supplierMatchCode: z.string().nullish(),
  supplierLogoName: z.string().nullish(),
  s3image: z.string().nullish(),
})

export const suppliersResponseSchema = z.array(supplierRawSchema)
export type SupplierRaw = z.infer<typeof supplierRawSchema>

/**
 * Parça detayı — GET /articles/article-complete-details/type-id/1?articleId=…
 * &countryFilterId=255&langId=23 (probe 2026-07-26, articleId 7858423).
 *
 * Probe bulguları:
 * - Yanıt tek `article` nesnesi; ÖZELLİK + OEM + EAN + görsel + uyumlu araçlar
 *   hepsi burada → ayrı `.../details`, `.../specifications-criterias`,
 *   `article-all-media-info` çağrılarına GEREK YOK (hepsi bu payload'ın alt
 *   kümesi; medya ucu denenen 4 parçanın hepsinde tek görsel döndürdü).
 * - `.../selection-of-the-criteria-for-articles-and-vehicle` ucu bu sağlayıcıda
 *   BOZUK: {countArticles: null, articles: null} döndürüyor (product-id olarak
 *   kategori id'si verildi). Araca özel bilgi `compatibleCars` eşleşmesinden
 *   çıkarılıyor.
 * - `criteriaValue` bazen sayı gelebiliyor → union(string, number).
 * - Ölçü adları langId=23 ile Türkçe geliyor ("Dış çap [mm]", "Dişli ölçüsü").
 */
const articleSpecRawSchema = z.object({
  criteriaName: z.string().nullish(),
  criteriaValue: z.union([z.string(), z.number()]).nullish(),
})

const articleOemRawSchema = z.object({
  oemBrand: z.string().nullish(),
  oemDisplayNo: z.string().nullish(),
})

const compatibleCarRawSchema = z.object({
  vehicleId: z.number().nullish(),
  modelId: z.number().nullish(),
  manufacturerName: z.string().nullish(),
  modelName: z.string().nullish(),
  typeEngineName: z.string().nullish(),
  constructionIntervalStart: z.string().nullish(),
  constructionIntervalEnd: z.string().nullish(),
})

export const articleDetailResponseSchema = z.object({
  article: z.object({
    articleId: z.number().nullish(),
    articleNo: z.string().nullish(),
    articleProductName: z.string().nullish(),
    supplierName: z.string().nullish(),
    supplierId: z.number().nullish(),
    s3image: z.string().nullish(),
    allSpecifications: z.array(articleSpecRawSchema).nullish(),
    oemNo: z.array(articleOemRawSchema).nullish(),
    // eanNumbers tek string ("8033977007781") ya da dizi olabilir.
    eanNo: z.object({ eanNumbers: z.union([z.string(), z.array(z.string())]).nullish() }).nullish(),
    compatibleCars: z.array(compatibleCarRawSchema).nullish(),
  }),
})

/**
 * Muadil / çapraz referans — GET /artlookup/select-article-cross-references/
 * article-id/{id}/lang-id/23 (probe 2026-07-26: 156 kayıt, 43 farklı marka).
 * `articleId` bazı kayıtlarda null (kataloğa bağlanamayan çapraz numara).
 */
export const crossRefsResponseSchema = z.object({
  countArticles: z.number().nullish(),
  articles: z
    .array(
      z.object({
        articleId: z.number().nullish(),
        articleNo: z.string().nullish(),
        supplierName: z.string().nullish(),
        supplierId: z.number().nullish(),
        articleProductName: z.string().nullish(),
        s3image: z.string().nullish(),
      })
    )
    .nullish(),
})
