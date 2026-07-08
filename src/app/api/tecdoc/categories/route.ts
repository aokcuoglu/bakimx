import { NextResponse } from "next/server"
import { getVehicleCategories } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const vehicleId = parsePositiveInt(new URL(request.url).searchParams.get("vehicleId"))
  if (vehicleId == null) {
    return NextResponse.json({ error: "Geçersiz araç katalog kimliği (vehicleId)." }, { status: 400 })
  }

  try {
    const categories = await getVehicleCategories(vehicleId)
    return NextResponse.json({ categories })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
