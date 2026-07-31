import { expect, test } from "bun:test"
import { normalizeSupplierPriceRows, derivePartPricing, type SupplierPriceRow } from "./supplier-prices"

function row(over: Partial<SupplierPriceRow> = {}): SupplierPriceRow {
  return { supplierId: "s1", purchasePrice: 1000, supplierSku: "", isPreferred: false, ...over }
}

test("boş liste boş döner", () => {
  expect(normalizeSupplierPriceRows([])).toEqual([])
})

test("tedarikçisi seçilmemiş satırlar atılır", () => {
  const rows = [row({ supplierId: "" }), row({ supplierId: "s2" })]
  const result = normalizeSupplierPriceRows(rows)
  expect(result).toHaveLength(1)
  expect(result[0].supplierId).toBe("s2")
})

test("hiç varsayılan yoksa ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([row({ supplierId: "s1" }), row({ supplierId: "s2" })])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("birden fazla varsayılan varsa yalnız ilki kalır", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "s1", isPreferred: true }),
    row({ supplierId: "s2", isPreferred: true }),
  ])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("varsayılan satır atılırsa kalan ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "", isPreferred: true }),
    row({ supplierId: "s2" }),
    row({ supplierId: "s3" }),
  ])
  expect(result.map((r) => [r.supplierId, r.isPreferred])).toEqual([
    ["s2", true],
    ["s3", false],
  ])
})

test("satır yoksa parça fiyatı ve tedarikçisi null olur", () => {
  expect(derivePartPricing([])).toEqual({ purchasePrice: null, supplierId: null })
})

test("varsayılan satırın fiyatı ve tedarikçisi parçaya taşınır", () => {
  const rows = normalizeSupplierPriceRows([
    row({ supplierId: "s1", purchasePrice: 5000 }),
    row({ supplierId: "s2", purchasePrice: 4000, isPreferred: true }),
  ])
  expect(derivePartPricing(rows)).toEqual({ purchasePrice: 4000, supplierId: "s2" })
})
