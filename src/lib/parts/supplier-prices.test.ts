import { expect, test } from "bun:test"
import {
  normalizeSupplierPriceRows,
  derivePartPricing,
  shouldPreserveDerivedPricing,
  type SupplierPriceRow,
} from "./supplier-prices"

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

// ── Türetilmiş alan koruması (eski, satırsız parçalar) ──────────────────────

test("alan hiç gönderilmediyse türetilmiş alanlara dokunulmaz", () => {
  expect(shouldPreserveDerivedPricing({ touched: false, incomingRowCount: 0, existingRowCount: 0 })).toBe(true)
  expect(shouldPreserveDerivedPricing({ touched: false, incomingRowCount: 0, existingRowCount: 3 })).toBe(true)
})

test("satırı hiç olmayan eski parçanın fiyatı/tedarikçisi boş listede korunur", () => {
  // Backfill'in ulaşamadığı parça (ör. fiyatı var, carisi yok) düzenlenirken
  // form boş liste gönderir — bu silme sayılmamalı.
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 0, existingRowCount: 0 })).toBe(true)
})

test("kullanıcı mevcut satırların hepsini silerse türetilmiş alanlar temizlenir", () => {
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 0, existingRowCount: 2 })).toBe(false)
})

test("satır gönderildiyse türetilmiş alanlar her durumda yazılır", () => {
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 1, existingRowCount: 0 })).toBe(false)
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 2, existingRowCount: 2 })).toBe(false)
})
