/**
 * Servisler arası araç geçmişinin (BAK-77) saf kurgu katmanı.
 *
 * DB'den okunan yabancı atölye satırlarını, istemciye gidecek maskeli/maskesiz
 * DTO'ya çevirir. Prisma'ya hiç dokunmaz ki hem test edilebilsin hem de "hangi
 * alan dışarı çıkıyor" kararı tek bir okunabilir yerde dursun.
 *
 * Fiyat yasağı için bkz. `types.ts`.
 */

import { maskEmail, maskFreeText, maskPersonName, maskPhone, maskSerial, MASK } from "./mask"
import type {
  CrossWorkshopDamage,
  CrossWorkshopHistory,
  CrossWorkshopOrder,
  CrossWorkshopVehicle,
  VehicleHistoryAccessReason,
} from "./types"

/** Listelerin üst sınırı — bir araç onlarca serviste gezmiş olabilir. */
export const MAX_CROSS_WORKSHOP_ORDERS = 20
export const MAX_CROSS_WORKSHOP_DAMAGES = 20

/**
 * `build`'in beklediği girdi. Bilerek DAR tutuldu: para alanı taşıyan hiçbir
 * Prisma modeli buraya olduğu gibi verilemez, çağıran tarafın alanları tek tek
 * seçmesi gerekir.
 */
export type ForeignVehicleRow = {
  workshopId: string
  workshopName: string
  workshopCity: string | null
  updatedAt: Date
  brand: string | null
  model: string | null
  vehicleType: string | null
  modelYear: number | null
  color: string | null
  fuelType: string | null
  transmission: string | null
  vin: string | null
  engineNo: string | null
  mileage: number | null
  customer: {
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
    email: string | null
    city: string | null
  } | null
  intakes: Array<{
    createdAt: Date
    mileageAtIntake: number | null
    customerComplaint: string | null
    order: {
      status: string
      arrivalReason: string | null
      createdAt: Date
      /** Sorgu sınırında `type=part` ile daraltılmış değişen parça adları. */
      partNames: string[]
    } | null
    damageMarks: Array<{
      zone: string
      damageType: string
      severity: string
      createdAt: Date
    }>
  }>
}

function ownerDisplayName(c: NonNullable<ForeignVehicleRow["customer"]>): string {
  if (c.type === "corporate") return c.companyName?.trim() || "Kurumsal Müşteri"
  const joined = [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
  return c.fullName?.trim() || joined || "Müşteri"
}

/**
 * Aracın künyesini hangi satırdan alacağımız: en son güncellenen yabancı kayıt.
 * Aynı araç farklı servislerde farklı doldurulmuş olabilir; en taze kayıt en
 * doğru olanıdır.
 */
function newestRow(rows: ForeignVehicleRow[]): ForeignVehicleRow | null {
  if (rows.length === 0) return null
  return rows.reduce((best, r) => (r.updatedAt > best.updatedAt ? r : best))
}

export function buildCrossWorkshopHistory({
  plate,
  rows,
  accessReason,
}: {
  plate: string
  rows: ForeignVehicleRow[]
  accessReason: VehicleHistoryAccessReason | null
}): CrossWorkshopHistory {
  const locked = accessReason === null
  const show = <T,>(value: T, masked: T): T => (locked ? masked : value)

  const orders: CrossWorkshopOrder[] = []
  const damageMarks: CrossWorkshopDamage[] = []

  for (const row of rows) {
    // Atölye adı da maskelenir: aracın hangi servislerde gezdiği tek başına
    // kişisel veriyle birleşen bir izdir; maske kalkmadan verilmez.
    const workshopName = show(row.workshopName, MASK)
    const workshopCity = show(row.workshopCity, null)

    for (const intake of row.intakes) {
      // Sorgu da yalnız `delivered` emirleri seçer; bu ikinci kontrol DTO
      // sınırını bağımsız olarak güvenli tutar ve yanlışlıkla daha geniş bir
      // satır kümesi geçirilse bile yabancı taslak/iptal emirlerini dışarı vermez.
      if (intake.order?.status === "delivered") {
        orders.push({
          key: `${row.workshopId}:o${orders.length}`,
          workshopName,
          workshopCity,
          servicedAt: intake.order.createdAt.toISOString(),
          status: intake.order.status,
          arrivalReason: show(intake.order.arrivalReason, null),
          mileage: show(intake.mileageAtIntake, null),
          complaint: locked
            ? maskFreeText(intake.customerComplaint)
            : intake.customerComplaint?.trim() || null,
          // Kalem başlıkları maskeliyken hiç taşınmaz; "ne yapıldığı" da
          // korunması gereken bir bilgidir.
          itemLabels: locked ? [] : intake.order.partNames.filter((n) => n.trim().length > 0),
        })
      }
      for (const dm of intake.damageMarks) {
        damageMarks.push({
          key: `${row.workshopId}:d${damageMarks.length}`,
          workshopName,
          zone: dm.zone,
          damageType: dm.damageType,
          severity: dm.severity,
          markedAt: dm.createdAt.toISOString(),
        })
      }
    }
  }

  orders.sort((a, b) => b.servicedAt.localeCompare(a.servicedAt))
  damageMarks.sort((a, b) => b.markedAt.localeCompare(a.markedAt))

  const newest = newestRow(rows)
  const owner = newest?.customer ?? null
  const vehicle: CrossWorkshopVehicle | null = newest
    ? {
        // Marka/model/tip kişisel veri değildir; maskeliyken de görünür ki
        // kullanıcı doğru aracı bulduğunu anlayabilsin.
        brand: newest.brand,
        model: newest.model,
        vehicleType: newest.vehicleType,
        modelYear: newest.modelYear,
        color: show(newest.color, null),
        fuelType: show(newest.fuelType, null),
        transmission: show(newest.transmission, null),
        vin: locked ? maskSerial(newest.vin) : newest.vin,
        engineNo: locked ? maskSerial(newest.engineNo) : newest.engineNo,
        lastKnownMileage: show(newest.mileage, null),
      }
    : null

  return {
    plate,
    locked,
    accessReason,
    workshopCount: rows.length,
    orderCount: orders.length,
    lastServicedAt: orders[0]?.servicedAt ?? null,
    vehicle,
    owner: owner
      ? {
          name: locked ? maskPersonName(ownerDisplayName(owner)) : ownerDisplayName(owner),
          phone: locked ? maskPhone(owner.phone) : owner.phone,
          email: locked ? maskEmail(owner.email) : owner.email,
          city: locked ? maskFreeText(owner.city) : owner.city,
        }
      : null,
    orders: orders.slice(0, MAX_CROSS_WORKSHOP_ORDERS),
    damageMarks: damageMarks.slice(0, MAX_CROSS_WORKSHOP_DAMAGES),
  }
}

/** Hiç yabancı kayıt yokken dönen boş sonuç. */
export function emptyCrossWorkshopHistory(plate: string): CrossWorkshopHistory {
  return {
    plate,
    locked: false,
    accessReason: null,
    workshopCount: 0,
    orderCount: 0,
    lastServicedAt: null,
    owner: null,
    vehicle: null,
    orders: [],
    damageMarks: [],
  }
}
