import { test, expect } from "bun:test"
import { getMockSupplierPrices } from "./mock-supplier-prices"

const PART = { sku: "16129BW", name: "Sensör, motor" }

test("deterministic: same input yields identical result", () => {
  const a = getMockSupplierPrices(PART)
  const b = getMockSupplierPrices(PART)
  expect(a).toEqual(b)
})

test("offers sorted by price ascending and cheapestIndex is 0", () => {
  const { offers, cheapestIndex } = getMockSupplierPrices(PART)
  expect(offers.length).toBeGreaterThanOrEqual(4)
  for (let i = 1; i < offers.length; i++) {
    expect(offers[i].priceKurus).toBeGreaterThanOrEqual(offers[i - 1].priceKurus)
  }
  expect(cheapestIndex).toBe(0)
})

test("all prices are positive integer kurus", () => {
  for (const o of getMockSupplierPrices(PART).offers) {
    expect(Number.isInteger(o.priceKurus)).toBe(true)
    expect(o.priceKurus).toBeGreaterThan(0)
  }
})

test("different part number produces a different price set", () => {
  const a = getMockSupplierPrices({ sku: "16129BW", name: "Sensör, motor" })
  const b = getMockSupplierPrices({ sku: "0281002216", name: "Basınç sensörü" })
  expect(a.offers.map((o) => o.priceKurus)).not.toEqual(b.offers.map((o) => o.priceKurus))
})

test("falls back to name when sku is missing (still deterministic)", () => {
  const a = getMockSupplierPrices({ sku: null, name: "Fren balatası ön" })
  const b = getMockSupplierPrices({ sku: null, name: "Fren balatası ön" })
  expect(a).toEqual(b)
  expect(a.offers.length).toBeGreaterThanOrEqual(4)
})

test("result is flagged as mock and each offer is well-formed", () => {
  const res = getMockSupplierPrices(PART)
  expect(res.isMock).toBe(true)
  for (const o of res.offers) {
    expect(o.supplierName.length).toBeGreaterThan(0)
    expect(o.articleNo.length).toBeGreaterThan(0)
    expect(["oem", "aftermarket"]).toContain(o.brandKind)
    expect(["in_stock", "low_stock", "orderable"]).toContain(o.stock)
    expect(o.deliveryLabel.length).toBeGreaterThan(0)
  }
})
