import { expect, test } from "bun:test"
import { buildUnifiedResults, displayCustomerName } from "@/lib/search/unified-results"

const indiv = { id: "c1", firstName: "Ahmet", lastName: "Yılmaz", fullName: null, companyName: null, type: "individual", phone: "05321112233" }
const corp = { id: "c2", firstName: null, lastName: null, fullName: null, companyName: "Acme A.Ş.", type: "corporate", phone: "02129990000" }

test("displayCustomerName: bireysel ad+soyad kullanır", () => {
  expect(displayCustomerName(indiv)).toBe("Ahmet Yılmaz")
})

test("displayCustomerName: kurumsal şirket adını kullanır", () => {
  expect(displayCustomerName(corp)).toBe("Acme A.Ş.")
})

test("displayCustomerName: null güvenli", () => {
  expect(displayCustomerName(null)).toBe("—")
})

test("buildUnifiedResults: önce araçlar (plaka etiketi + sahip alt-etiketi), sonra müşteriler", () => {
  const out = buildUnifiedResults({
    customers: [indiv],
    vehicles: [{ id: "v1", plate: "34ABC123", brand: "Renault", model: "Clio", customerId: "c1", customer: indiv }],
  })
  expect(out[0]).toEqual({
    kind: "vehicle", vehicleId: "v1", customerId: "c1", plate: "34ABC123",
    label: "34ABC123 — Renault Clio", sublabel: "Sahip: Ahmet Yılmaz",
  })
  expect(out[1]).toEqual({ kind: "customer", customerId: "c1", label: "Ahmet Yılmaz", sublabel: "05321112233" })
})

test("buildUnifiedResults: boş girdi → boş liste", () => {
  expect(buildUnifiedResults({ customers: [], vehicles: [] })).toEqual([])
})
