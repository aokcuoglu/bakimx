import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { listBakimxCategories } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * Parça seçicinin "BakımX Ürünleri" dalını dolduran iç taksonomi —
 * `GET /api/catalog/bakimx/categories`.
 *
 * Yalnız atölyeye görünen (aktif, `universal`, markası aktif) ürünü olan
 * kategoriler döner; her yaprak `productCount` taşır, böylece dal boş
 * listelenmez. Arama ucu aynı `key`'i `?categoryKey=` ile kabul eder.
 */
export async function GET() {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  try {
    const categories = await listBakimxCategories()
    return NextResponse.json({ categories })
  } catch (err) {
    console.error("[bakimx-catalog/categories]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
