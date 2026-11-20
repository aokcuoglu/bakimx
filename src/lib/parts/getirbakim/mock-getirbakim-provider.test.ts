import { expect, test } from "bun:test"
import { getMockGetirbakimProvider, mockGetirbakimFitLevel } from "./mock-getirbakim-provider"

/** Demo veriyle uyum rozetleri yerelde ve testte görünsün (#755). */

test("araç verilince her seviyeden bir ürün döner ve uyanlar önce gelir", async () => {
  // "a" üç demo ürününün hepsini bulur.
  const all = await getMockGetirbakimProvider().search({ q: "a", vehicleTypeId: 16573 })
  expect(all).toHaveLength(3)
  const levels = all.map((p) => p.fitmentLevel)
  expect(new Set(levels)).toEqual(new Set(["guaranteed", "likely", "unknown"]))
  expect(levels).toEqual([...levels].sort((a, b) =>
    ["guaranteed", "likely", "unknown"].indexOf(a) - ["guaranteed", "likely", "unknown"].indexOf(b)))

  const confirmed = all.find((p) => p.fitmentLevel === "guaranteed")!
  expect(confirmed.exactFitment).toEqual({
    requestedVehicleTypeId: 16573, status: "CONFIRMED", matchedVehicleTypeIds: [16573],
  })
  expect(all.find((p) => p.fitmentLevel === "likely")?.exactFitment.status).toBe("NOT_CONFIRMED")
})

test("seviye deterministiktir ve araca göre değişir", async () => {
  expect(mockGetirbakimFitLevel("gb-1001", 3)).toBe(mockGetirbakimFitLevel("gb-1001", 3))
  expect(mockGetirbakimFitLevel("gb-1001", 3)).not.toBe(mockGetirbakimFitLevel("gb-1001", 4))
  expect(mockGetirbakimFitLevel("yok", 3)).toBe("unknown")
})

test("araç verilmezse uyum iddiası yok", async () => {
  const products = await getMockGetirbakimProvider().search({ q: "a" })
  expect(products.every((p) => p.fitmentLevel === "unknown" && p.exactFitment.status === "NOT_REQUESTED")).toBe(true)
})
