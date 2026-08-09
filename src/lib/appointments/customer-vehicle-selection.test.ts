import { test, expect, afterEach } from "bun:test"
import {
  fetchCustomerVehicles,
  reconcileVehicleId,
  toVehicleChoices,
  vehicleChoiceLabel,
  withVehicle,
  type VehicleChoice,
} from "./customer-vehicle-selection"

const VEHICLE: VehicleChoice = { id: "v1", plate: "34 MYL 739", brand: "Renault", model: "Megane" }

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
})

function stubFetch(status: number, body: unknown) {
  let captured = ""
  global.fetch = (async (url: string) => {
    captured = url
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return () => captured
}

test("etiket plaka + marka/model birleştirir", () => {
  expect(vehicleChoiceLabel(VEHICLE)).toBe("34 MYL 739 — Renault Megane")
})

test("marka/model boşsa etiket yalnız plakadır (asılı tire kalmaz)", () => {
  expect(vehicleChoiceLabel({ id: "v2", plate: "06 ABC 12", brand: "", model: "" })).toBe("06 ABC 12")
})

test("API cevabı seçenek listesine indirgenir", () => {
  const raw = [{ id: "v1", plate: "34 MYL 739", brand: "Renault", model: "Megane", customer: { id: "c1" } }]
  expect(toVehicleChoices(raw)).toEqual([VEHICLE])
})

test("beklenmeyen cevap şekli boş liste döner", () => {
  expect(toVehicleChoices(null)).toEqual([])
  expect(toVehicleChoices({ error: "yetkisiz" })).toEqual([])
  expect(toVehicleChoices([null, { plate: "34 MYL 739" }])).toEqual([])
})

test("müşteri değişince listede olmayan araç seçimi temizlenir", () => {
  expect(reconcileVehicleId("v1", [VEHICLE])).toBe("v1")
  expect(reconcileVehicleId("v1", [])).toBe("")
  expect(reconcileVehicleId("v1", [{ ...VEHICLE, id: "v2" }])).toBe("")
  expect(reconcileVehicleId("", [VEHICLE])).toBe("")
})

test("yeni oluşturulan araç listenin başına eklenir, kopyalanmaz", () => {
  const created: VehicleChoice = { id: "v9", plate: "06 XYZ 90", brand: "Fiat", model: "Egea" }
  expect(withVehicle([VEHICLE], created)).toEqual([created, VEHICLE])
  expect(withVehicle([VEHICLE], VEHICLE)).toEqual([VEHICLE])
})

test("araçlar müşteriye göre sorgulanır", async () => {
  const captured = stubFetch(200, [{ id: "v1", plate: "34 MYL 739", brand: "Renault", model: "Megane" }])
  await expect(fetchCustomerVehicles("c 1")).resolves.toEqual([VEHICLE])
  expect(captured()).toBe("/api/vehicles?customerId=c%201")
})

test("müşteri yokken istek atılmaz", async () => {
  global.fetch = (() => {
    throw new Error("fetch çağrılmamalıydı")
  }) as unknown as typeof fetch
  await expect(fetchCustomerVehicles("")).resolves.toEqual([])
})

test("hatalı cevapta boş liste döner", async () => {
  stubFetch(403, { error: "yetkisiz" })
  await expect(fetchCustomerVehicles("c1")).resolves.toEqual([])
})
