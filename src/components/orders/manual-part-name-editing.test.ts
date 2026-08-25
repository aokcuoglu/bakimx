import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const ACTIONS = readFileSync(join(import.meta.dir, "../../app/(app)/orders/actions.ts"), "utf8")

test("iş emri parça tanımı tüm kaynaklarda düzenlenebilir ve mevcut PATCH akışına yazılır", () => {
  const partField = GRID.slice(GRID.indexOf("function PartField("), GRID.indexOf("function QtyStepper("))

  expect(partField).toContain("ed.isPart && ed.editable")
  expect(partField).toContain("<PartNameField row={row} onCell={onCell}")
  expect(GRID).toContain("if (name !== row.name) onCell(row, { name })")
  expect(GRID).toContain("if (!name)")
  expect(GRID).toContain("onBlur={commit}")
  expect(GRID).toContain('fd.set("name", patch.name)')
  expect(GRID).toContain('method: "PATCH"')
  expect(ACTIONS).toContain("if (parsed.data.name !== undefined) data.name = parsed.data.name")
  expect(ACTIONS).toContain("serviceOrderItem.updateMany({ where: guardedWhere, data })")
})

test("katalog kimliği (sku/marka/kategori) kilitli kalır; satır adı (display name) serbesttir", () => {
  const partField = GRID.slice(GRID.indexOf("function PartField("), GRID.indexOf("function QtyStepper("))

  expect(partField).toContain("<PartNameField row={row} onCell={onCell}")
  expect(GRID).toContain("row.tecdocArticleId != null || row.bakimxProductId != null || row.getirbakimProductId != null")
  expect(GRID).toContain("Yalnız bu iş emri ve çıktılarda görünür; katalog / stok tanımı değişmez")

  // TecDoc identity guard no longer blocks name — only sku/brand/category.
  expect(ACTIONS).not.toContain("parsed.data.name !== undefined && parsed.data.name !== item.name")
  expect(ACTIONS).toContain("overwrites(parsed.data.sku, item.sku)")
  expect(ACTIONS).toContain("overwrites(parsed.data.brand, item.brand)")
  expect(ACTIONS).toContain("overwrites(parsed.data.category, item.category)")
  expect(ACTIONS).toContain("Katalogdan eklenen parçanın kodu, markası ve kategorisi değiştirilemez")
  expect(ACTIONS).not.toContain("Katalogdan eklenen parçanın adı, kodu, markası ve kategorisi değiştirilemez")
})
