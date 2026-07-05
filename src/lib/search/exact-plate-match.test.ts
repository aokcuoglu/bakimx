import { test, expect } from "bun:test"
import { findExactPlateMatch } from "./exact-plate-match"
import type { UnifiedResult } from "./unified-results"

const vehicle = (plate: string, id = "v1"): UnifiedResult => ({
  kind: "vehicle",
  vehicleId: id,
  customerId: `c-${id}`,
  plate,
  label: `${plate} — Peugeot Boxer`,
  sublabel: "Sahip: Ahmet Kaya",
})

const customer: UnifiedResult = { kind: "customer", customerId: "cX", label: "Ahmet Kaya", sublabel: "0555" }

test("returns the vehicle whose plate matches exactly (ignoring spacing/case)", () => {
  const results = [customer, vehicle("34 MYL 739")]
  expect(findExactPlateMatch(results, "34myl739")).toEqual({
    vehicleId: "v1",
    customerId: "c-v1",
    label: "34 MYL 739 — Peugeot Boxer",
    sublabel: "Sahip: Ahmet Kaya",
  })
})

test("does not match a plate that only contains the query", () => {
  const results = [vehicle("34 MYL 7391")]
  expect(findExactPlateMatch(results, "34 MYL 739")).toBeNull()
})

test("returns null for blank plate", () => {
  expect(findExactPlateMatch([vehicle("34 MYL 739")], "   ")).toBeNull()
})

test("ignores customer results", () => {
  expect(findExactPlateMatch([customer], "34 MYL 739")).toBeNull()
})

test("returns the first exact match when duplicates exist", () => {
  const results = [vehicle("34 MYL 739", "a"), vehicle("34 MYL 739", "b")]
  expect(findExactPlateMatch(results, "34 MYL 739")?.vehicleId).toBe("a")
})
