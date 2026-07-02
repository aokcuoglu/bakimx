import { TecdocError, type ArticleSummary, type CategoryNode } from "./types"
import { categoriesResponseSchema, articlesResponseSchema, type CategoryNodeRaw } from "./schemas"

function toNode(raw: CategoryNodeRaw): CategoryNode {
  const childMap =
    raw.children && !Array.isArray(raw.children) ? raw.children : ({} as Record<string, CategoryNodeRaw>)
  const children = Object.values(childMap)
    .map(toNode)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
  return { id: raw.categoryId, name: raw.categoryName, children }
}

/** Raw variant-2 payload → sorted CategoryNode tree. Throws provider_error on shape mismatch. */
export function normalizeCategories(raw: unknown): CategoryNode[] {
  const parsed = categoriesResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TecdocError("provider_error", "Katalog kategori cevabı beklenen biçimde değil.")
  }
  return Object.values(parsed.data.categories)
    .map(toNode)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
}

/** Raw GET-legacy articles payload → ArticleSummary[]. Tolerates null articles (empty category). */
export function normalizeArticles(raw: unknown): ArticleSummary[] {
  const parsed = articlesResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TecdocError("provider_error", "Katalog parça cevabı beklenen biçimde değil.")
  }
  return (parsed.data.articles ?? []).map((a) => ({
    tecdocArticleId: a.articleId,
    articleNo: a.articleNo,
    productName: a.articleProductName || "Parça",
    supplierName: a.supplierName || "",
    supplierId: a.supplierId ?? null,
    imageUrl: a.s3image || null,
  }))
}
