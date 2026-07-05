import { NextResponse } from "next/server"
import { getPartBrands } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse } from "@/lib/tecdoc/api-helpers"

/**
 * GET /api/tecdoc/brands — tüm parça markaları (TecDoc suppliers).
 * Araç-bağımsız, tek sefer çekilir ve cache'lenir (cache key `suppliers:list`).
 * Combobox client-side filter yapar — search param YOK. Auth + partsCatalog
 * feature gate + rate limit tecdocRouteGuard'dan gelir.
 */
export async function GET() {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard
  try {
    const brands = await getPartBrands()
    return NextResponse.json({ brands })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}