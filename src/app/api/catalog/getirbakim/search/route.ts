import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { getirbakimRouteGuard } from "@/lib/parts/getirbakim/guard"
import { searchGetirbakimProducts } from "@/lib/parts/getirbakim/search"
import { parseGetirbakimVehicleTypeId } from "@/lib/parts/getirbakim/types"

/**
 * GetirBakım stok/fiyat araması — `GET /api/catalog/getirbakim/search` (BAK-183).
 *
 * `?oem=` verilirse parça koduyla tam eşleşme aranır, yoksa `?q=` ile serbest
 * metin. `?limit=` sunucuda kırpılır.
 *
 * FİYAT İSTEMCİDEN GELMEZ: bu uç yalnız arama terimi ve limit okur; fiyat ve
 * stok sunucuda sağlayıcıdan çözülür (src/lib/parts/getirbakim/search.ts).
 * Yanıttaki fiyatlar KDV HARİÇ ve kuruştur — `b2bPriceKurus` atölyenin ALIŞ
 * fiyatıdır, yüzeyde gösterilen ve kaleme yazılan odur.
 *
 * `lastSyncedAt` yüzeye taşınmak ZORUNDA: bu uç anlık stok vaat etmez.
 */
export async function GET(request: Request) {
  const guard = await getirbakimRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const requestedLimit = Number(params.get("limit"))
  const vehicleTypeId = parseGetirbakimVehicleTypeId(params.get("vehicleTypeId"))
  if (vehicleTypeId === undefined) {
    return NextResponse.json({ error: "Geçersiz vehicleTypeId." }, { status: 400 })
  }

  try {
    const products = await searchGetirbakimProducts({
      q: params.get("q"),
      oem: params.get("oem"),
      limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : null,
      vehicleTypeId,
    })
    return NextResponse.json({ products })
  } catch (err) {
    console.error("[getirbakim/search]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
