/**
 * Servisler arası araç geçmişinin (BAK-77) veri erişimi.
 *
 * Bu, kiracı izolasyonunun BİLEREK aşıldığı tek okuma yoludur; o yüzden burada
 * `workshopId` filtresi yerine `workshopId: { not: ... }` görürsünüz. Kural
 * şudur: sorgu KENDİ atölyeni dışlar, yalnız YABANCI kayıtları getirir; kendi
 * kayıtların zaten sayfanın normal sorgusundan gelir. Böylece bir kaydın iki
 * kez (biri maskeli) görünmesi mümkün olmaz.
 *
 * `select` listeleri bilerek tek tek yazıldı — `include` kullanılsaydı modele
 * eklenen yeni bir para/kimlik alanı sessizce başka kiracıya akardı.
 */

import { prisma } from "@/lib/db"
import { normalizePlate } from "@/lib/format"
import { buildCrossWorkshopHistory, emptyCrossWorkshopHistory, type ForeignVehicleRow } from "./build"
import { resolveVehicleHistoryAccess } from "./access"
import type { CrossWorkshopHistory } from "./types"

/** Aynı plakayı taşıyan yabancı araç kaydı üst sınırı. */
const MAX_FOREIGN_VEHICLES = 25

export async function getCrossWorkshopVehicleHistory({
  workshopId,
  plate,
}: {
  workshopId: string
  plate: string
}): Promise<CrossWorkshopHistory> {
  const normalized = normalizePlate(plate)
  if (normalized.length < 5) return emptyCrossWorkshopHistory(normalized)

  const foreign = await prisma.vehicle.findMany({
    where: { plate: normalized, workshopId: { not: workshopId } },
    take: MAX_FOREIGN_VEHICLES,
    orderBy: { updatedAt: "desc" },
    select: {
      workshopId: true,
      updatedAt: true,
      brand: true,
      model: true,
      vehicleType: true,
      modelYear: true,
      color: true,
      fuelType: true,
      transmission: true,
      vin: true,
      engineNo: true,
      mileage: true,
      workshop: { select: { name: true, city: true } },
      customer: {
        select: {
          type: true,
          firstName: true,
          lastName: true,
          fullName: true,
          companyName: true,
          phone: true,
          email: true,
          city: true,
          // identityNumber / taxNumber / address BİLEREK YOK — maskeli hâlleri
          // bile atölye sınırını geçmez.
        },
      },
      intakes: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          mileageAtIntake: true,
          customerComplaint: true,
          damageMarks: {
            select: { zone: true, damageType: true, severity: true, createdAt: true },
          },
          order: {
            select: {
              status: true,
              arrivalReason: true,
              createdAt: true,
              // Yalnız kalem ADI. unitPrice/totalPrice/quantity ALINMAZ.
              items: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (foreign.length === 0) return emptyCrossWorkshopHistory(normalized)

  const accessReason = await resolveVehicleHistoryAccess(workshopId, normalized)

  const rows: ForeignVehicleRow[] = foreign.map((v) => ({
    workshopId: v.workshopId,
    workshopName: v.workshop.name,
    workshopCity: v.workshop.city,
    updatedAt: v.updatedAt,
    brand: v.brand,
    model: v.model,
    vehicleType: v.vehicleType,
    modelYear: v.modelYear,
    color: v.color,
    fuelType: v.fuelType,
    transmission: v.transmission,
    vin: v.vin,
    engineNo: v.engineNo,
    mileage: v.mileage,
    customer: v.customer,
    intakes: v.intakes.map((i) => ({
      createdAt: i.createdAt,
      mileageAtIntake: i.mileageAtIntake,
      customerComplaint: i.customerComplaint,
      damageMarks: i.damageMarks,
      order: i.order
        ? {
            status: i.order.status,
            arrivalReason: i.order.arrivalReason,
            createdAt: i.order.createdAt,
            itemNames: i.order.items.map((it) => it.name),
          }
        : null,
    })),
  }))

  return buildCrossWorkshopHistory({ plate: normalized, rows, accessReason })
}
