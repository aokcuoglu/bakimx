import { NextResponse } from "next/server"
import { getPartBrands, getVehicleBrands, getCategoryBrands } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

/**
 * GET /api/tecdoc/brands — parça markaları (TecDoc suppliers).
 * - parametresiz → global suppliers (geri uyumluluk).
 * - ?vehicleId=X → o araç için cache'li makalelerdeki distinct markalar (araç-scoped).
 * - ?vehicleId=X&categoryId=Y → o kategorinin markaları (güvenilir; gerekirse provider fetch).
 * Auth + partsCatalog feature gate + rate limit tecdocRouteGuard'dan gelir.
 */
export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  const categoryId = parsePositiveInt(params.get("categoryId"))

  try {
    let brands
    if (vehicleId != null && categoryId != null) {
      brands = await getCategoryBrands(vehicleId, categoryId)
    } else if (vehicleId != null) {
      brands = await getVehicleBrands(vehicleId)
    } else {
      brands = await getPartBrands()
    }
    return NextResponse.json({ brands })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
