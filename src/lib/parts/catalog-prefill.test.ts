import { describe, expect, test } from "bun:test"
import type { BakimxProductSummary } from "./bakimx-catalog"
import type { GetirbakimProduct } from "./getirbakim/types"
import { applyCatalogPrefill, bakimxStockPrefill, getirbakimStockPrefill } from "./catalog-prefill"

function bakimx(overrides: Partial<BakimxProductSummary> = {}): BakimxProductSummary {
  return {
    id: "bx1",
    sku: "AF-MTL-72",
    name: "Mutlu Akü 12V 72Ah",
    brandId: "b1",
    brandName: "Mutlu",
    categoryKey: "aku",
    categoryLabel: "Akü",
    barcode: "8690000000001",
    unit: "adet",
    description: "Bakımsız akü",
    imageUrl: null,
    oemNumbers: ["L3.72.064.A", "X-2"],
    workshopPriceKurus: 500_000,
    displayPriceKurus: 430_000,
    discountBps: 1400,
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 4,
    backorderable: false,
    leadTimeDays: null,
    ...overrides,
  }
}

function getirbakim(overrides: Partial<GetirbakimProduct> = {}): GetirbakimProduct {
  return {
    contractVersion: "1.2",
    sourceProductId: "gb-src-1",
    id: "gb1",
    partNo: "GB-0001",
    manufacturerPartNumber: { value: "0986424815", normalized: "0986424815" },
    name: "Fren Balatası Ön",
    brandName: "Bosch",
    categoryName: "Fren",
    oemNumbers: ["1K0698151"],
    references: [],
    exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
    imageUrl: null,
    listPriceKurus: 120_000,
    b2bPriceKurus: 99_000,
    discountBps: 1750,
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 3,
    availability: "IN_STOCK",
    lastSyncedAt: null,
    ...overrides,
  }
}

describe("bakimxStockPrefill", () => {
  test("maps identity fields and uses the discounted purchase price, never the list price", () => {
    const p = bakimxStockPrefill(bakimx())
    expect(p.fields).toEqual({
      name: "Mutlu Akü 12V 72Ah",
      sku: "AF-MTL-72",
      oemNo: "L3.72.064.A",
      brand: "Mutlu",
      category: "Akü",
      unit: "adet",
      barcode: "8690000000001",
      description: "Bakımsız akü",
    })
    expect(p.purchasePriceKurus).toBe(430_000)
    expect(p.sourceLabel).toBe("BakımX kataloğu")
  })

  test("omits fields the catalog has no value for", () => {
    const p = bakimxStockPrefill(bakimx({ oemNumbers: [], categoryLabel: null, barcode: null, description: "  " }))
    expect(p.fields.oemNo).toBeUndefined()
    expect(p.fields.category).toBeUndefined()
    expect(p.fields.barcode).toBeUndefined()
    expect(p.fields.description).toBeUndefined()
  })
})

describe("getirbakimStockPrefill", () => {
  test("prefers the manufacturer part number and uses the B2B price", () => {
    const p = getirbakimStockPrefill(getirbakim())
    expect(p.fields).toEqual({
      name: "Fren Balatası Ön",
      sku: "0986424815",
      oemNo: "1K0698151",
      brand: "Bosch",
      category: "Fren",
    })
    expect(p.purchasePriceKurus).toBe(99_000)
    expect(p.sourceLabel).toBe("GetirBakım")
  })

  test("falls back to partNo and keeps a missing price as null", () => {
    const p = getirbakimStockPrefill(getirbakim({ manufacturerPartNumber: null, b2bPriceKurus: null, categoryName: null }))
    expect(p.fields.sku).toBe("GB-0001")
    expect(p.fields.category).toBeUndefined()
    expect(p.purchasePriceKurus).toBeNull()
  })
})

describe("applyCatalogPrefill", () => {
  test("writes only the provided fields and leaves workshop-specific ones alone", () => {
    const writes: [string, string][] = []
    applyCatalogPrefill(getirbakimStockPrefill(getirbakim({ categoryName: null })), (name, value) => {
      writes.push([name, value])
    })
    const names = writes.map(([n]) => n)
    expect(names).toEqual(["name", "sku", "oemNo", "brand"])
    for (const forbidden of ["salePrice", "stockQty", "shelfLocation", "supplierPrices", "category"]) {
      expect(names).not.toContain(forbidden)
    }
  })
})
