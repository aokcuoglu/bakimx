import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminCapability } from "@/lib/admin"
import { tecdocErrorResponse } from "@/lib/tecdoc/api-helpers"

interface CategoryOption {
  id: number
  name: string
}

/**
 * GET /api/admin/tecdoc-categories — distinct TecDoc categories for product linking (BAK-45).
 *
 * Returns all unique category IDs that appear in tecdoc_articles, fetched from the cache.
 * Assumes category IDs are vehicle-independent (standard TecDoc behavior).
 *
 * Rate limit: none (internal admin-only endpoint, not user-facing).
 */
export async function GET() {
  await requireAdminCapability("manageCatalog")

  try {
    const categories = await prisma.tecdocArticle.findMany({
      distinct: ["categoryId"],
      select: { categoryId: true },
      orderBy: { categoryId: "asc" },
    })

    const categoryIds = categories.map((c) => c.categoryId)
    if (categoryIds.length === 0) {
      return NextResponse.json({ categories: [] })
    }

    // Fetch category names from tecdoc_cache using any article from each category
    // (names are the same across vehicles per BAK-45 assumption).
    const articlesByCategory = await prisma.tecdocArticle.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { categoryId: true, productName: true },
      distinct: ["categoryId"],
    })

    // Build a map of categoryId -> productName (generic category label)
    const categoryNameMap = new Map<number, string>()
    for (const article of articlesByCategory) {
      if (!categoryNameMap.has(article.categoryId)) {
        categoryNameMap.set(article.categoryId, article.productName.split(",")[0] || "Parça")
      }
    }

    const result: CategoryOption[] = categoryIds.map((id) => ({
      id,
      name: categoryNameMap.get(id) || `Kategori ${id}`,
    }))

    return NextResponse.json({ categories: result })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
