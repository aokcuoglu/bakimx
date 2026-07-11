import { NextResponse } from "next/server"
import { getVehicleCategories, getBrandCategoryIds } from "@/lib/tecdoc/catalog"
import { pruneTreeToCategoryIds } from "@/lib/tecdoc/tree"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  if (vehicleId == null) {
    return NextResponse.json({ error: "Geçersiz araç katalog kimliği (vehicleId)." }, { status: 400 })
  }
  const supplierId = parsePositiveInt(params.get("supplierId"))

  try {
    const categories = await getVehicleCategories(vehicleId)
    if (supplierId == null) {
      return NextResponse.json({ categories })
    }
    // Best-effort marka→kategori: yalnız o markanın cache'li makalelerinin
    // bulunduğu kategorilere ait dalları koru.
    const allowed = new Set(await getBrandCategoryIds(vehicleId, supplierId))
    return NextResponse.json({ categories: pruneTreeToCategoryIds(categories, allowed) })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
