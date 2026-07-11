import { TecdocError, type ArticleSummary, type CategoryNode, type PartBrandSummary } from "./types"
import {
  categoriesResponseSchema,
  articlesResponseSchema,
  suppliersResponseSchema,
  type CategoryNodeRaw,
} from "./schemas"

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

/** Raw GET /suppliers/list array → sorted PartBrandSummary[]. Throws provider_error on shape mismatch. */
export function normalizeSuppliers(raw: unknown): PartBrandSummary[] {
  const parsed = suppliersResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TecdocError("provider_error", "Parça markası cevabı beklenen biçimde değil.")
  }
  return parsed.data
    .map((s) => ({ supplierId: s.supplierId, name: s.supplierName }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
}

/**
 * TecdocArticle satırlarından (supplierId, supplierName) → tekil, tr-sıralı
 * PartBrandSummary[]. supplierId null olan satırlar (filtrelenemez marka) atlanır.
 */
export function dedupeBrands(
  rows: { supplierId: number | null; supplierName: string }[]
): PartBrandSummary[] {
  const byId = new Map<number, string>()
  for (const r of rows) {
    if (r.supplierId == null) continue
    if (!byId.has(r.supplierId)) byId.set(r.supplierId, r.supplierName)
  }
  return [...byId.entries()]
    .map(([supplierId, name]) => ({ supplierId, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
}
