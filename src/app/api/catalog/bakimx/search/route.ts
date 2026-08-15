import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { searchBakimxProducts } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * BakımX kendi kataloğunda arama — `GET /api/catalog/bakimx/search`.
 *
 * `?q=` `searchKey` kolonunda katlanmış terimlerle AND'lenir ("aku" → "Akü…"),
 * `?brandId=` / `?categoryKey=` daraltır, `?limit=` sunucuda kırpılır,
 * `?vehicleTypeId=` araç bazlı ürünleri filtreler. Yanıttaki ürünler public
 * DTO'dur: iç maliyet ve içe aktarım alanları yoktur (src/lib/parts/bakimx-catalog.ts).
 *
 * Fiyat alanı `workshopPriceKurus` = atölyenin ALIŞ fiyatı, KDV HARİÇ.
 */
export async function GET(request: Request) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const requestedLimit = Number(params.get("limit"))
  const vehicleTypeId = params.get("vehicleTypeId") ? Number(params.get("vehicleTypeId")) : null

  try {
    const products = await searchBakimxProducts({
      q: params.get("q"),
      brandId: params.get("brandId"),
      categoryKey: params.get("categoryKey"),
      limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : null,
      vehicleTypeId: vehicleTypeId && Number.isFinite(vehicleTypeId) ? vehicleTypeId : null,
    })
    return NextResponse.json({ products })
  } catch (err) {
    console.error("[bakimx-catalog/search]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
