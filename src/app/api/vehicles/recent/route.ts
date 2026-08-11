import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"
import {
  RECENT_VEHICLE_LIMIT,
  buildRecentVehicleResults,
  recentServicedVehicleIds,
} from "@/lib/search/recent-vehicles"

// Kabul formlarında ne kadar geriye bakılacağı. Aynı araç peş peşe birkaç kez
// kabul edilebildiği için tekilleştirmeden sonra LIMIT'in dolabilmesi adına
// tarama penceresi listeden geniş tutulur.
const INTAKE_SCAN_WINDOW = 60

const vehicleSelect = Prisma.validator<Prisma.VehicleSelect>()({
  id: true,
  plate: true,
  brand: true,
  model: true,
  customerId: true,
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      companyName: true,
      type: true,
      phone: true,
    },
  },
})

/**
 * Kabul ekranındaki "Son araçlar" kısayolu (#309): kayıtlı bir aracı hiç yazmadan
 * seçebilmek için son işlem gören, eksik kalırsa en son eklenen araçları döner.
 * Arama uç noktasıyla aynı `UnifiedResult` biçimini kullanır — picker tarafında
 * seçim yolu ortaktır. Her sorgu atölyeye sabitlenmiştir.
 */
export async function GET() {
  try {
    const user = await requireAuth()

    const intakes = await prisma.vehicleIntakeForm.findMany({
      where: { workshopId: user.workshopId },
      orderBy: { createdAt: "desc" },
      take: INTAKE_SCAN_WINDOW,
      select: { vehicleId: true },
    })
    const servicedIds = recentServicedVehicleIds(intakes)

    const [serviced, newest] = await Promise.all([
      servicedIds.length
        ? prisma.vehicle.findMany({
            where: { workshopId: user.workshopId, id: { in: servicedIds } },
            select: vehicleSelect,
          })
        : [],
      // Kabul kaydı LIMIT'i doldurmadıysa (yeni atölye, yeni eklenmiş araç) listeyi
      // en son eklenen araçlarla tamamla.
      servicedIds.length >= RECENT_VEHICLE_LIMIT
        ? []
        : prisma.vehicle.findMany({
            where: { workshopId: user.workshopId },
            orderBy: { createdAt: "desc" },
            take: RECENT_VEHICLE_LIMIT,
            select: vehicleSelect,
          }),
    ])

    return NextResponse.json({ results: buildRecentVehicleResults({ servicedIds, serviced, newest }) })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
