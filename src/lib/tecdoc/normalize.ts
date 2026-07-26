import {
  TecdocError,
  type ArticleCrossRef,
  type ArticleDetail,
  type ArticleFitment,
  type ArticleSummary,
  type CategoryNode,
  type PartBrandSummary,
} from "./types"
import {
  categoriesResponseSchema,
  articlesResponseSchema,
  articleDetailResponseSchema,
  crossRefsResponseSchema,
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

/**
 * Raw article-complete-details payload → ArticleDetail.
 *
 * Savunmacı: eksik/boş alt listeler boş diziye düşer (parça detayı yine açılır),
 * yalnız üst şekil tutmazsa provider_error atar. `articleId` fallback'i çağıran
 * taraftan gelir — sağlayıcı bazı kayıtlarda alanı boş bırakabiliyor.
 */
export function normalizeArticleDetail(raw: unknown, fallbackArticleId: number): ArticleDetail {
  const parsed = articleDetailResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TecdocError("provider_error", "Parça detay cevabı beklenen biçimde değil.")
  }
  const a = parsed.data.article

  const ean = a.eanNo?.eanNumbers
  const eanNumbers = (Array.isArray(ean) ? ean : ean ? [ean] : []).map((e) => e.trim()).filter(Boolean)

  return {
    tecdocArticleId: a.articleId ?? fallbackArticleId,
    articleNo: a.articleNo || "",
    productName: a.articleProductName || "Parça",
    supplierName: a.supplierName || "",
    supplierId: a.supplierId ?? null,
    imageUrl: a.s3image || null,
    specs: (a.allSpecifications ?? [])
      .map((s) => ({ name: (s.criteriaName || "").trim(), value: String(s.criteriaValue ?? "").trim() }))
      // Adı ya da değeri boş olan ölçüt kullanıcıya bir şey anlatmaz.
      .filter((s) => s.name !== "" && s.value !== ""),
    oems: (a.oemNo ?? [])
      .map((o) => ({ brand: (o.oemBrand || "").trim(), number: (o.oemDisplayNo || "").trim() }))
      .filter((o) => o.number !== ""),
    eanNumbers,
    compatibleCars: (a.compatibleCars ?? [])
      .filter((c): c is typeof c & { vehicleId: number } => typeof c.vehicleId === "number")
      .map(
        (c): ArticleFitment => ({
          vehicleId: c.vehicleId,
          manufacturerName: c.manufacturerName || "",
          modelName: c.modelName || "",
          typeEngineName: c.typeEngineName || "",
          constructionIntervalStart: c.constructionIntervalStart || null,
          constructionIntervalEnd: c.constructionIntervalEnd || null,
        })
      ),
  }
}

/**
 * Raw cross-references payload → ArticleCrossRef[]. Aynı (marka, numara) çifti
 * tekrar edebiliyor → tekilleştirilir, marka adına göre tr-sıralanır.
 */
export function normalizeCrossRefs(raw: unknown): ArticleCrossRef[] {
  const parsed = crossRefsResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TecdocError("provider_error", "Muadil parça cevabı beklenen biçimde değil.")
  }
  const seen = new Set<string>()
  const out: ArticleCrossRef[] = []
  for (const a of parsed.data.articles ?? []) {
    const articleNo = (a.articleNo || "").trim()
    if (!articleNo) continue
    const supplierName = (a.supplierName || "").trim()
    const key = `${supplierName}::${articleNo}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      tecdocArticleId: a.articleId ?? null,
      articleNo,
      supplierName,
      productName: a.articleProductName || "",
      imageUrl: a.s3image || null,
    })
  }
  return out.sort(
    (x, y) => x.supplierName.localeCompare(y.supplierName, "tr") || x.articleNo.localeCompare(y.articleNo, "tr")
  )
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
