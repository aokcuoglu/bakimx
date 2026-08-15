import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"
import { BAKIMX_PRODUCT_SUMMARY_SELECT, toBakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

/**
 * GET /api/parts/by-tecdoc-category/:categoryId — BakımX products linked to a TecDoc category (BAK-45).
 *
 * Returns products with `tecdocCategoryId` matching the given category, including price/stock info
 * for rendering badges. Used by parts picker to show BakımX products alongside TecDoc articles.
 *
 * No auth gate: endpoint is public (doesn't expose private data), rate-limited at TecDoc level.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/parts/by-tecdoc-category/[categoryId]">,
) {
  const { categoryId } = await context.params
  const id = parsePositiveInt(categoryId)

  if (id == null) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 })
  }

  try {
    const products = await prisma.bakimxProduct.findMany({
      where: {
        tecdocCategoryId: id,
        isActive: true,
      },
      select: BAKIMX_PRODUCT_SUMMARY_SELECT,
      orderBy: [{ brandName: "asc" }, { name: "asc" }],
    })

    const result: BakimxProductSummary[] = products.map(toBakimxProductSummary)

    return NextResponse.json({ products: result })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
