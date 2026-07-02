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
