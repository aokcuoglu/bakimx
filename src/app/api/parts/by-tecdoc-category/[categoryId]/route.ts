import { NextResponse, type NextRequest } from "next/server"
import { tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"
import { listBakimxProductsByTecdocCategory } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * GET /api/parts/by-tecdoc-category/:categoryId — BakımX products linked to a TecDoc category (BAK-45).
 *
 * Returns products with `tecdocCategoryId` matching the given category, including price/stock info
 * for rendering badges. Used by parts picker to show BakımX products alongside TecDoc articles.
 *
 * Ortak BakımX katalog kapısı auth, feature gate ve atölye bazlı rate limit uygular.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ categoryId: string }> },
) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  const { categoryId } = await context.params
  const id = parsePositiveInt(categoryId)

  if (id == null) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 })
  }

  try {
    const products = await listBakimxProductsByTecdocCategory(id)
    return NextResponse.json({ products })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
