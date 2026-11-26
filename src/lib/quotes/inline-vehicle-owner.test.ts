import { expect, test } from "bun:test"
import { resolveInlineVehicleOwner } from "./inline-vehicle-owner"

const a = { id: "va" }
const b = { id: "vb" }

test("sahip seçili müşteriyse müşteri değişmez, araç listeye eklenir", () => {
  const r = resolveInlineVehicleOwner({
    selectedCustomerId: "c1", resultCustomerId: "c1", current: [a], created: b,
  })
  expect(r.switchCustomer).toBeNull()
  expect(r.vehicles).toEqual([b, a])
})

test("araç zaten listedeyse tekrar eklenmez", () => {
  const r = resolveInlineVehicleOwner({
    selectedCustomerId: "c1", resultCustomerId: "c1", current: [a], created: a,
  })
  expect(r.vehicles).toEqual([a])
})

test("başka müşterinin aracı: müşteri sahibine çevrilir, liste yalnız o araç (#915)", () => {
  const r = resolveInlineVehicleOwner({
    selectedCustomerId: "c1", resultCustomerId: "c2", resultCustomerName: "Ayşe", current: [a], created: b,
  })
  expect(r.switchCustomer).toEqual({ id: "c2", label: "Ayşe" })
  expect(r.vehicles).toEqual([b])
})

test("sahip adı yoksa genel etiket kullanılır", () => {
  const r = resolveInlineVehicleOwner({
    selectedCustomerId: "c1", resultCustomerId: "c2", current: [], created: b,
  })
  expect(r.switchCustomer?.label).toBe("Seçili müşteri")
})
