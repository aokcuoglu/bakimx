import { test, expect } from "bun:test"
import { normalizePartNumbers, partNameWithBrand, toPartBoxResult, PartBoxFieldsSchema } from "./part-box-result"

test("normalizePartNumbers: trim + uppercase + tekilleştir", () => {
  const out = normalizePartNumbers([
    { value: " sto-539 ", label: "SETA CODE" },
    { value: "sto-539", label: "SETA CODE" }, // dup (case/space farkı)
    { value: "04152-yzza6", label: "OEM NO", confidence: 0.8 },
    { value: "  ", label: "boş" }, // atılır
  ])
  expect(out).toEqual([
    { value: "STO-539", label: "SETA CODE", confidence: undefined },
    { value: "04152-YZZA6", label: "OEM NO", confidence: 0.8 },
  ])
})

test("partNameWithBrand: marka adı sonuna eklenir", () => {
  expect(partNameWithBrand("Yağ filtresi", "SETA")).toBe("Yağ filtresi — SETA")
})

test("partNameWithBrand: marka boşsa ad aynen döner", () => {
  expect(partNameWithBrand("Yağ filtresi", "  ")).toBe("Yağ filtresi")
})

test("partNameWithBrand: marka zaten ad içindeyse tekrarlamaz", () => {
  expect(partNameWithBrand("SETA Yağ filtresi", "seta")).toBe("SETA Yağ filtresi")
})

test("toPartBoxResult: uncertainFields düşük güven verir, numaraları normalize eder", () => {
  const fields = PartBoxFieldsSchema.parse({
    partName: " Yağ filtresi ",
    brand: "SETA",
    partNumbers: [{ value: "hu 6006 z", label: "MANN NO", confidence: 0.6 }],
    uncertainFields: ["brand"],
  })
  const r = toPartBoxResult(fields, "mock")
  expect(r.partName).toEqual({ value: "Yağ filtresi", confidence: 0.9 })
  expect(r.brand).toEqual({ value: "SETA", confidence: 0.5 })
  expect(r.partNumbers).toEqual([{ value: "HU 6006 Z", label: "MANN NO", confidence: 0.6 }])
  expect(r.provider).toBe("mock")
})
