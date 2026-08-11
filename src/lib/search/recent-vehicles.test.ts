import { expect, test } from "bun:test"
import { buildRecentVehicleResults, recentServicedVehicleIds } from "@/lib/search/recent-vehicles"
import type { VehicleLite } from "@/lib/search/unified-results"

const owner = { id: "c1", firstName: "Ahmet", lastName: "Yılmaz", fullName: null, companyName: null, type: "individual", phone: "05321112233" }

function vehicle(id: string, plate: string): VehicleLite {
  return { id, plate, brand: "Renault", model: "Clio", customerId: owner.id, customer: owner }
}

test("recentServicedVehicleIds: aynı aracı bir kez, en yeni kaydının sırasında döner", () => {
  const ids = recentServicedVehicleIds([
    { vehicleId: "v1" },
    { vehicleId: "v2" },
    { vehicleId: "v1" },
    { vehicleId: "v3" },
  ])
  expect(ids).toEqual(["v1", "v2", "v3"])
})

test("recentServicedVehicleIds: limiti aşmaz", () => {
  const ids = recentServicedVehicleIds([{ vehicleId: "v1" }, { vehicleId: "v2" }, { vehicleId: "v3" }], 2)
  expect(ids).toEqual(["v1", "v2"])
})

test("recentServicedVehicleIds: boş vehicleId atlanır", () => {
  expect(recentServicedVehicleIds([{ vehicleId: "" }, { vehicleId: "v1" }])).toEqual(["v1"])
})

test("buildRecentVehicleResults: önce son işlem görenler, sonra en yeni eklenenler", () => {
  const out = buildRecentVehicleResults({
    servicedIds: ["v2", "v1"],
    serviced: [vehicle("v1", "34ABC123"), vehicle("v2", "06XYZ789")],
    newest: [vehicle("v3", "35QWE456"), vehicle("v1", "34ABC123")],
    limit: 3,
  })
  expect(out.map((r) => (r.kind === "vehicle" ? r.vehicleId : r.customerId))).toEqual(["v2", "v1", "v3"])
  expect(out[0]).toEqual({
    kind: "vehicle", vehicleId: "v2", customerId: "c1", plate: "06XYZ789",
    label: "06XYZ789 — Renault Clio", sublabel: "Sahip: Ahmet Yılmaz",
  })
})

test("buildRecentVehicleResults: aynı araç iki kez listelenmez", () => {
  const out = buildRecentVehicleResults({
    servicedIds: ["v1"],
    serviced: [vehicle("v1", "34ABC123")],
    newest: [vehicle("v1", "34ABC123")],
  })
  expect(out).toHaveLength(1)
})

test("buildRecentVehicleResults: kabul kaydı yoksa yalnız en yeni eklenenlerden dolar", () => {
  const out = buildRecentVehicleResults({
    servicedIds: [],
    serviced: [],
    newest: [vehicle("v9", "01AAA111"), vehicle("v8", "02BBB222")],
  })
  expect(out.map((r) => (r.kind === "vehicle" ? r.vehicleId : ""))).toEqual(["v9", "v8"])
})

test("buildRecentVehicleResults: silinmiş/erişilemeyen serviced id sessizce atlanır", () => {
  const out = buildRecentVehicleResults({
    servicedIds: ["gone", "v1"],
    serviced: [vehicle("v1", "34ABC123")],
    newest: [],
  })
  expect(out.map((r) => (r.kind === "vehicle" ? r.vehicleId : ""))).toEqual(["v1"])
})

test("buildRecentVehicleResults: limit toplam sonucu sınırlar", () => {
  const out = buildRecentVehicleResults({
    servicedIds: ["v1", "v2"],
    serviced: [vehicle("v1", "34ABC123"), vehicle("v2", "06XYZ789")],
    newest: [vehicle("v3", "35QWE456")],
    limit: 1,
  })
  expect(out.map((r) => (r.kind === "vehicle" ? r.vehicleId : ""))).toEqual(["v1"])
})
