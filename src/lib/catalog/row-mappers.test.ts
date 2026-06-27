import { test, expect } from "bun:test"
import { mapBrand, mapModel, mapType, mapTypeDetail } from "./row-mappers"

test("mapBrand maps id + name", () => {
  expect(mapBrand({ id: 3854, name: "ABARTH" })).toEqual({ id: 3854, name: "ABARTH" })
})

test("mapModel maps fields and null dates", () => {
  expect(mapModel({ id: 278, name: "145 (930_)", date_from: "1994-07", date_to: null, brand_id: 2 }))
    .toEqual({ id: 278, name: "145 (930_)", dateFrom: "1994-07", dateTo: null, brandId: 2 })
})

test("mapType coerces nullable numerics", () => {
  expect(mapType({ id: 1, name: "1.4", cc: 1364, fuel_type: "Petrol", hp: 90, kwt: 66, year_of_constr_from: "2006-07", year_of_constr_to: null, model_id: 5598 }))
    .toEqual({ id: 1, name: "1.4", cc: 1364, fuelType: "Petrol", hp: 90, kwt: 66, yearFrom: "2006-07", yearTo: null, modelId: 5598 })
})

test("mapTypeDetail parses bigint id, dates, and json", () => {
  const r = mapTypeDetail({
    id: "1", vehicle_type_id: 1, brake_system: null, car_id: 1, ccm_tech: 1364,
    construction_type: "Hatchback", cylinder: 4, cylinder_capacity_ccm: 1364,
    cylinder_capacity_liter: 140, fuel_type: "Petrol", fuel_type_process: "Injection",
    impulsion_type: "FWD", manu_id: 84, manu_name: "OPEL", mod_id: 5598,
    model_name: "CORSA D (S07)", motor_type: "Petrol Engine", power_hp_from: 90, power_hp_to: 90,
    power_kw_from: 66, power_kw_to: 66, type_name: "1.4 (L08, L68)", type_number: 1, valves: 4,
    year_of_constr_from: "2006-07", year_of_constr_to: "2014-08", rmi_type_id: 66229,
    motor_codes: ["Z 14 XEP"], raw_payload: { carId: 1 },
    created_at: "2026-03-01T14:11:40.709Z", updated_at: "2026-03-02T02:00:06.651Z",
  })
  expect(r.id).toBe(1n)
  expect(r.vehicleTypeId).toBe(1)
  expect(r.ccmTech).toBe(1364)
  expect(r.motorCodes).toEqual(["Z 14 XEP"])
  expect(r.createdAt instanceof Date).toBe(true)
  expect(r.createdAt.toISOString()).toBe("2026-03-01T14:11:40.709Z")
})
