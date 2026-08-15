import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { listBakimxCategories, parseVehicleTypeIdParam } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * Parça seçicinin "BakımX Ürünleri" dalını dolduran iç taksonomi —
 * `GET /api/catalog/bakimx/categories`.
 *
 * Yalnız atölyeye görünen (aktif, markası aktif) ürünü olan kategoriler döner;
 * her yaprak `productCount` taşır, böylece dal boş listelenmez. Arama ucu aynı
 * `key`'i `?categoryKey=` ile kabul eder.
 *
 * `?vehicleTypeId=` arama ucuyla AYNI görünürlük filtresini besler (BAK-46) —
 * ikisi ayrışırsa ağaçta sayılan kategori aramada boş liste döndürür.
 */
export async function GET(request: Request) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams

  try {
    const categories = await listBakimxCategories(parseVehicleTypeIdParam(params.get("vehicleTypeId")))
    return NextResponse.json({ categories })
  } catch (err) {
    console.error("[bakimx-catalog/categories]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
