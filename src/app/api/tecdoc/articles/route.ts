import { NextResponse } from "next/server"
import { getArticlesByCategory } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  const categoryId = parsePositiveInt(params.get("categoryId"))
  if (vehicleId == null || categoryId == null) {
    return NextResponse.json({ error: "Geçersiz katalog parametreleri (vehicleId/categoryId)." }, { status: 400 })
  }

  try {
    const articles = await getArticlesByCategory(vehicleId, categoryId)
    return NextResponse.json({ articles })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
