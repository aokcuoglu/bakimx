import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"
import { normalizePlate } from "@/lib/format"
import { getCrossWorkshopVehicleHistory } from "@/lib/vehicle-history/queries"
import { emptyCrossWorkshopHistory } from "@/lib/vehicle-history/build"

/**
 * Aracın BAŞKA servislerdeki geçmişi (BAK-77).
 *
 * İki giriş kabul eder:
 *   • `?vehicleId=` — kendi atölyendeki araç kaydı üzerinden (plaka sunucuda
 *     çözülür; başka kiracının aracına id ile erişilemez, sorgu atölyeye sabit).
 *   • `?plate=`     — henüz kaydı olmayan araç için (sihirbazın ilk adımı).
 *
 * Serbest plaka sorgusunun bilerek açık bırakılmasının sebebi, kullanıcının
 * aracı kaydetmeden önce "bu araç başka serviste var mı" sorusunu sorabilmesi.
 * Sızıntı riski yoktur: hak yoksa dönen gövde zaten maskelidir ve kişisel alan
 * taşımaz (bkz. `src/lib/vehicle-history/build.ts`).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const vehicleId = searchParams.get("vehicleId")?.trim()
    let plate = normalizePlate(searchParams.get("plate") ?? "")

    if (vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, workshopId: user.workshopId },
        select: { plate: true },
      })
      if (!vehicle) return NextResponse.json({ error: "Araç bulunamadı" }, { status: 404 })
      plate = normalizePlate(vehicle.plate)
    }

    if (plate.length < 5) return NextResponse.json(emptyCrossWorkshopHistory(plate))

    const history = await getCrossWorkshopVehicleHistory({ workshopId: user.workshopId, plate })
    return NextResponse.json(history)
  } catch (err) {
    return apiErrorResponse(err)
  }
}
