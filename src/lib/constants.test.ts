import { test, expect } from "bun:test"
import { tecdocFuelToFormValue, isArrivalReason, arrivalReasonLabel, ARRIVAL_REASON_ORDER } from "./constants"

test("tecdocFuelToFormValue maps TecDoc English fuel names to form slugs", () => {
  expect(tecdocFuelToFormValue("Diesel")).toBe("dizel")
  expect(tecdocFuelToFormValue("Petrol")).toBe("benzin")
  expect(tecdocFuelToFormValue("LPG")).toBe("lpg")
  expect(tecdocFuelToFormValue("Hybrid")).toBe("hibrit")
  expect(tecdocFuelToFormValue("Electric")).toBe("elektrik")
  expect(tecdocFuelToFormValue("Diesel/Electro")).toBe("dizel") // mHEV listing: diesel wins
  expect(tecdocFuelToFormValue(null)).toBe("")
  expect(tecdocFuelToFormValue("Unknown")).toBe("")
})

test("isArrivalReason yalnız tanımlı nedenleri kabul eder", () => {
  expect(isArrivalReason("fault")).toBe(true)
  expect(isArrivalReason("accessory")).toBe(true)
  expect(isArrivalReason("kaza")).toBe(false)
  expect(isArrivalReason("")).toBe(false)
})

test("isArrivalReason prototip anahtarlarını kabul etmez", () => {
  // `key in obj` kullanılırsa "toString" true döner; guard liste tabanlı olmalı.
  expect(isArrivalReason("toString")).toBe(false)
  expect(isArrivalReason("constructor")).toBe(false)
})

test("arrivalReasonLabel Türkçe etiket döner, boş değerde tire", () => {
  expect(arrivalReasonLabel("fault")).toBe("Arıza")
  expect(arrivalReasonLabel("damage")).toBe("Hasar")
  expect(arrivalReasonLabel("maintenance")).toBe("Bakım")
  expect(arrivalReasonLabel("inspection")).toBe("Kontrol")
  expect(arrivalReasonLabel("accessory")).toBe("Aksesuar")
  expect(arrivalReasonLabel(null)).toBe("—")
  expect(arrivalReasonLabel("")).toBe("—")
})

test("arrivalReasonLabel tanınmayan değeri olduğu gibi döner", () => {
  expect(arrivalReasonLabel("bilinmeyen")).toBe("bilinmeyen")
})

test("ARRIVAL_REASON_ORDER beş nedeni ürün sırasında tutar", () => {
  expect(ARRIVAL_REASON_ORDER).toEqual(["fault", "damage", "maintenance", "inspection", "accessory"])
})
