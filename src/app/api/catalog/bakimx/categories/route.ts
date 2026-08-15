import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { listBakimxCategories } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * Parça seçicinin "BakımX Ürünleri" dalını dolduran iç taksonomi —
 * `GET /api/catalog/bakimx/categories`.
 *
 * Yalnız atölyeye görünen (aktif, markası aktif, araç eşleştirmesi varsa Faz 2)
 * ürünü olan kategoriler döner; her yaprak `productCount` taşır, böylece dal boş
 * listelenmez. Arama ucu aynı `key`'i `?categoryKey=` ile kabul eder.
 * `?vehicleTypeId=` araç bazlı ürünleri filtreler.
 */
export async function GET(request: Request) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleTypeId = params.get("vehicleTypeId") ? Number(params.get("vehicleTypeId")) : undefined

  try {
    const categories = await listBakimxCategories(vehicleTypeId && Number.isFinite(vehicleTypeId) ? vehicleTypeId : undefined)
    return NextResponse.json({ categories })
  } catch (err) {
    console.error("[bakimx-catalog/categories]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
