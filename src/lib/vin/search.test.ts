import { describe, expect, it } from "bun:test"
import { searchQueryFor, visibleResultsFor } from "./search"
import type { UnifiedResult } from "@/lib/search/unified-results"

describe("searchQueryFor", () => {
  it("plate mode: trims and returns the raw query", () => {
    expect(searchQueryFor("plate", "  34abc123 ")).toBe("34abc123")
  })
  it("plate mode: blank → null", () => {
    expect(searchQueryFor("plate", "   ")).toBeNull()
  })
  it("customer mode: always null (picker-level search off)", () => {
    expect(searchQueryFor("customer", "ahmet")).toBeNull()
  })
  it("vin mode: valid 17-char VIN → normalized (upper, no spaces)", () => {
    expect(searchQueryFor("vin", " wvwzzz1kz aw000001 ")).toBe("WVWZZZ1KZAW000001")
  })
  it("vin mode: partial VIN → null (no DB call)", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZ")).toBeNull()
  })
  it("vin mode: 17 chars with illegal O → null", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZAW0O0001")).toBeNull()
  })
})

/**
 * #152: tek kutu hem plakayı hem müşteriyi arasın. Uç nokta ikisini de
 * döndürüyordu, daraltma UI'daydı — bu yüzden regresyon riski "birinin sessizce
 * listeden düşmesi". VIN modu araca özgü kalmalı.
 */
describe("visibleResultsFor", () => {
const veh = (id: string): UnifiedResult => ({
  kind: "vehicle", vehicleId: id, customerId: `c-${id}`, plate: id, label: id, sublabel: "",
})
const cust = (id: string): UnifiedResult => ({
  kind: "customer", customerId: id, label: id, sublabel: "",
})

  it("varsayılan modda araç ve müşteri birlikte listelenir", () => {
  const results = [veh("34ABC123"), cust("Ali")]
  expect(visibleResultsFor("plate", results)).toEqual(results)
})

  it("varsayılan mod sırayı bozmaz — araçlar önce kalır", () => {
  const results = [veh("a"), veh("b"), cust("c")]
  expect(visibleResultsFor("plate", results).map((r) => r.kind)).toEqual([
    "vehicle", "vehicle", "customer",
  ])
})

  it("VIN modunda müşteri sonucu gösterilmez", () => {
  expect(visibleResultsFor("vin", [veh("a"), cust("b")])).toEqual([veh("a")])
})

  it("müşteri modunda araç sonucu gösterilmez", () => {
  expect(visibleResultsFor("customer", [veh("a"), cust("b")])).toEqual([cust("b")])
})

  it("boş sonuç listesi her modda boş kalır", () => {
  for (const m of ["plate", "vin", "customer"] as const) {
    expect(visibleResultsFor(m, [])).toEqual([])
  }
})
})
