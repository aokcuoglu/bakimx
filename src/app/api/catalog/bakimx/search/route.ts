import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { searchBakimxProducts, parseVehicleTypeIdParam } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * BakımX kendi kataloğunda arama — `GET /api/catalog/bakimx/search`.
 *
 * `?q=` `searchKey` kolonunda katlanmış terimlerle AND'lenir ("aku" → "Akü…"),
 * `?brandId=` / `?categoryKey=` daraltır, `?limit=` sunucuda kırpılır. Yanıttaki
 * ürünler public DTO'dur: iç maliyet ve içe aktarım alanları yoktur
 * (src/lib/parts/bakimx-catalog.ts).
 *
 * `?vehicleTypeId=` verilirse o araca eşlenmiş `vehicle_linked` ürünler de
 * listeye girer (BAK-46); verilmezse yalnız `universal` ürünler döner.
 *
 * Fiyat alanı `workshopPriceKurus` = atölyenin ALIŞ fiyatı, `displayPriceKurus` =
 * iskontolu satış fiyatı — KDV HARİÇ, her ikisi de kuruş (BAK-47).
 */
export async function GET(request: Request) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const requestedLimit = Number(params.get("limit"))

  try {
    const products = await searchBakimxProducts({
      q: params.get("q"),
      brandId: params.get("brandId"),
      categoryKey: params.get("categoryKey"),
      limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : null,
      vehicleTypeId: parseVehicleTypeIdParam(params.get("vehicleTypeId")),
      workshopId: guard.workshopId,
    })
    return NextResponse.json({ products })
  } catch (err) {
    console.error("[bakimx-catalog/search]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
