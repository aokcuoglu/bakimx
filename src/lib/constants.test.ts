import { test, expect } from "bun:test"
import { tecdocFuelToFormValue } from "./constants"

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
