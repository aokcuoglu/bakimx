import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getirbakimLineItemFields, isGetirbakimSelectable } from "./getirbakim-item"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"

const product = (over: Partial<GetirbakimProduct> = {}): GetirbakimProduct => ({
  contractVersion: "1.1",
  sourceProductId: "gb-1001",
  id: "gb-1001",
  partNo: "GDB1330",
  manufacturerPartNumber: { value: "GDB1330", normalized: "GDB1330" },
  name: "Fren Balatası Ön Takım",
  brandName: "TRW",
  categoryName: "Fren Balatası",
  oemNumbers: ["77362261"],
  references: [],
  exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
  imageUrl: null,
  listPriceKurus: 189_000,
  b2bPriceKurus: 160_650,
  discountBps: 1500,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 12,
  availability: "IN_STOCK",
  lastSyncedAt: "2026-08-20T06:00:00.000Z",
  ...over,
})

test("kalem stok kartına BAĞLANMAZ — stok düşümü tetiklenmez", () => {
  const fields = getirbakimLineItemFields(product())
  expect(fields.partId).toBeNull()
  expect(Object.keys(fields)).not.toContain("__partId")
})

test("categoryId null kalır — TecDoc düğüm id kolonuna GetirBakım kategorisi yazılmaz", () => {
  const fields = getirbakimLineItemFields(product())
  expect(fields.categoryId).toBeNull()
  expect(fields.category).toBe("Fren Balatası")
})

test("kategorisiz üründe kategori metni de boş kalır", () => {
  expect(getirbakimLineItemFields(product({ categoryName: null })).category).toBeNull()
})

test("alış GetirBakım b2b fiyatıdır, liste fiyatı yazılmaz", () => {
  const fields = getirbakimLineItemFields(product())
  expect(fields.purchasePriceKurus).toBe(160_650)
  expect(fields.unitPrice).toBe(160_650)
  expect(fields.purchasePriceKurus).not.toBe(189_000)
})

test("fiyatsız üründe alış ve satış boş kalır", () => {
  const fields = getirbakimLineItemFields(product({ b2bPriceKurus: null, listPriceKurus: null }))
  expect(fields.purchasePriceKurus).toBeNull()
  expect(fields.unitPrice).toBeNull()
})

test("sku üretici parça numarasından, yoksa partNo'dan gelir", () => {
  expect(getirbakimLineItemFields(product()).sku).toBe("GDB1330")
  expect(
    getirbakimLineItemFields(product({
      manufacturerPartNumber: null,
      partNo: "OC90",
    })).sku,
  ).toBe("OC90")
})

test("kimlik sourceProductId, kaynak getirbakim", () => {
  expect(getirbakimLineItemFields(product())).toMatchObject({
    source: "getirbakim",
    getirbakimProductId: "gb-1001",
    name: "Fren Balatası Ön Takım",
    brand: "TRW",
    unit: "adet",
  })
})

test("dış alım tedarikçi alanları YAZILMAZ", () => {
  const keys = Object.keys(getirbakimLineItemFields(product()))
  expect(keys).not.toContain("supplierName")
  expect(keys).not.toContain("supplierId")
})

test("UNAVAILABLE seçilemez; stoklu ve tedarik edilebilir seçilir", () => {
  expect(isGetirbakimSelectable(product({ availability: "UNAVAILABLE" }))).toBe(false)
  expect(isGetirbakimSelectable(product({ availability: "IN_STOCK" }))).toBe(true)
  expect(isGetirbakimSelectable(product({ availability: "SUPPLYABLE" }))).toBe(true)
})

test("addOrderItemAction GetirBakım kaleminde partId bağlamaz ve fiyatı sağlayıcıdan çözer", () => {
  const source = readFileSync(
    join(import.meta.dir, "..", "..", "app", "(app)", "orders", "actions.ts"),
    "utf8",
  )
  const start = source.indexOf("export async function addOrderItemAction(")
  expect(start, "addOrderItemAction bulunamadı").toBeGreaterThan(-1)
  const body = source.slice(start).split("\nexport ")[0]

  expect(body).toContain("resolveGetirbakimProduct(")
  expect(body).toContain("getirbakimLineItemFields(product)")
  expect(body).toContain("getirbakimCatalog")
  expect(body).toContain("partId: bakimxFields || getirbakimFields ? null : partId")
  expect(body).toContain("if (!bakimxFields && !getirbakimFields && partId && parsed.data.type === \"part\")")
})
