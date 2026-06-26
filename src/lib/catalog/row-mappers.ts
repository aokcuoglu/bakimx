import type { Prisma } from "@prisma/client"

export type RawRow = Record<string, unknown>

const num = (v: unknown): number => Number(v)
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue)

export function mapBrand(row: RawRow) {
  return { id: num(row.id), name: String(row.name) }
}

export function mapModel(row: RawRow) {
  return {
    id: num(row.id),
    name: String(row.name),
    dateFrom: strOrNull(row.date_from),
    dateTo: strOrNull(row.date_to),
    brandId: num(row.brand_id),
  }
}

export function mapType(row: RawRow) {
  return {
    id: num(row.id),
    name: String(row.name),
    cc: numOrNull(row.cc),
    fuelType: strOrNull(row.fuel_type),
    hp: numOrNull(row.hp),
    kwt: numOrNull(row.kwt),
    yearFrom: strOrNull(row.year_of_constr_from),
    yearTo: strOrNull(row.year_of_constr_to),
    modelId: num(row.model_id),
  }
}

export function mapTypeDetail(row: RawRow): Prisma.VehicleTypeDetailCreateManyInput {
  return {
    id: BigInt(String(row.id)),
    vehicleTypeId: num(row.vehicle_type_id),
    brakeSystem: strOrNull(row.brake_system),
    carId: numOrNull(row.car_id),
    ccmTech: numOrNull(row.ccm_tech),
    constructionType: strOrNull(row.construction_type),
    cylinder: numOrNull(row.cylinder),
    cylinderCapacityCcm: numOrNull(row.cylinder_capacity_ccm),
    cylinderCapacityLiter: numOrNull(row.cylinder_capacity_liter),
    fuelType: strOrNull(row.fuel_type),
    fuelTypeProcess: strOrNull(row.fuel_type_process),
    impulsionType: strOrNull(row.impulsion_type),
    manuId: numOrNull(row.manu_id),
    manuName: strOrNull(row.manu_name),
    modId: numOrNull(row.mod_id),
    modelName: strOrNull(row.model_name),
    motorType: strOrNull(row.motor_type),
    powerHpFrom: numOrNull(row.power_hp_from),
    powerHpTo: numOrNull(row.power_hp_to),
    powerKwFrom: numOrNull(row.power_kw_from),
    powerKwTo: numOrNull(row.power_kw_to),
    typeName: strOrNull(row.type_name),
    typeNumber: numOrNull(row.type_number),
    valves: numOrNull(row.valves),
    yearOfConstrFrom: strOrNull(row.year_of_constr_from),
    yearOfConstrTo: strOrNull(row.year_of_constr_to),
    rmiTypeId: numOrNull(row.rmi_type_id),
    motorCodes: json(row.motor_codes),
    rawPayload: json(row.raw_payload),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}
