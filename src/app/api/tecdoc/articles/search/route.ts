import { NextResponse } from "next/server"
import { searchVehicleArticles } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

/**
 * Parça numarası, adı, MARKASI veya kategori adıyla arama — bu araç için cache'lenmiş
 * parçalarda (DB-only, kotasız). Boşlukla ayrılan terimler AND'lenir ("bbr filtre").
 * Sağlayıcıda numara-arama ucu olmadığı için best-effort: yalnız daha önce göz
 * atılmış kategorilerdeki parçaları bulur (bkz. searchVehicleArticles).
 */
export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  if (vehicleId == null) {
    return NextResponse.json({ error: "Geçersiz araç katalog kimliği (vehicleId)." }, { status: 400 })
  }
  const q = params.get("q") || ""
  const supplierId = parsePositiveInt(params.get("supplierId"))
  const categoryId = parsePositiveInt(params.get("categoryId"))

  try {
    const articles = await searchVehicleArticles(vehicleId, q, { supplierId, categoryId })
    return NextResponse.json({ articles })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
