import { expect, test } from "bun:test"
import {
  dropForeignFitment,
  getirbakimFitLevel,
  getirbakimMatchesVehicle,
  sortGetirbakimByFit,
} from "./fitment"
import type { GetirbakimFitmentLevel, GetirbakimProduct } from "./types"

const product = (id: string, level: GetirbakimFitmentLevel, vehicleTypeId: number | null = 7): GetirbakimProduct => ({
  contractVersion: "1.3", sourceProductId: id, id, partNo: id,
  manufacturerPartNumber: null, name: `Ürün ${id}`, brandName: "GB",
  categoryName: null, oemNumbers: [], references: [],
  exactFitment: vehicleTypeId == null
    ? { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] }
    : level === "guaranteed"
      ? { requestedVehicleTypeId: vehicleTypeId, status: "CONFIRMED", matchedVehicleTypeIds: [vehicleTypeId] }
      : { requestedVehicleTypeId: vehicleTypeId, status: "NOT_CONFIRMED", matchedVehicleTypeIds: [] },
  fitmentLevel: level,
  imageUrl: null, listPriceKurus: 1000, b2bPriceKurus: 900, discountBps: 1000,
  vatRateBps: 2000, currency: "TRY", stockQty: 1, availability: "IN_STOCK", lastSyncedAt: null,
})

test("uyanlar önce: tam → muhtemel → diğer; seviye içinde alaka sırası korunur", () => {
  const sorted = sortGetirbakimByFit([
    product("u1", "unknown"),
    product("l1", "likely"),
    product("g1", "guaranteed"),
    product("u2", "unknown"),
    product("g2", "guaranteed"),
    product("l2", "likely"),
  ])
  expect(sorted.map((p) => p.id)).toEqual(["g1", "g2", "l1", "l2", "u1", "u2"])
})

test("sıralama hiçbir satırı elemez ve girdiyi değiştirmez", () => {
  const input = [product("u1", "unknown"), product("g1", "guaranteed")]
  const sorted = sortGetirbakimByFit(input)
  expect(sorted).toHaveLength(2)
  expect(input.map((p) => p.id)).toEqual(["u1", "g1"])
})

test("tam uyum yalnız CONFIRMED'dan gelir", () => {
  const forged = { ...product("x", "unknown"), fitmentLevel: "guaranteed" as const }
  expect(getirbakimFitLevel(forged)).toBe("unknown")
  // Eski önbellekten alan eksik gelse de CONFIRMED tam uyumludur.
  const legacy = { ...product("y", "guaranteed"), fitmentLevel: undefined } as unknown as GetirbakimProduct
  expect(getirbakimFitLevel(legacy)).toBe("guaranteed")
})

test("süzgeç tam ve muhtemel uyumu tutar", () => {
  expect(getirbakimMatchesVehicle(product("g", "guaranteed"))).toBe(true)
  expect(getirbakimMatchesVehicle(product("l", "likely"))).toBe(true)
  expect(getirbakimMatchesVehicle(product("u", "unknown"))).toBe(false)
})

test("başka aracın uyum iddiası bu araca taşınmaz", () => {
  const confirmedFor7 = product("g", "guaranteed", 7)
  expect(dropForeignFitment(confirmedFor7, 7)).toBe(confirmedFor7)
  const dropped = dropForeignFitment(confirmedFor7, 8)
  expect(dropped.exactFitment.status).toBe("NOT_REQUESTED")
  expect(dropped.fitmentLevel).toBe("unknown")
  expect(dropForeignFitment(product("l", "likely", 7), null).fitmentLevel).toBe("unknown")
})
