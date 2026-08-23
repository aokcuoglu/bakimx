import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const ACTIONS = readFileSync(join(import.meta.dir, "../../app/(app)/orders/actions.ts"), "utf8")

test("manuel parça tanımı düzenlenebilir ve mevcut PATCH akışına yazılır", () => {
  const partField = GRID.slice(GRID.indexOf("function PartField("), GRID.indexOf("function QtyStepper("))

  expect(partField).toContain('row.source === "manual" && ed.editable')
  expect(partField).toContain("<ManualPartNameField row={row} onCell={onCell} />")
  expect(GRID).toContain("if (name !== row.name) onCell(row, { name })")
  expect(GRID).toContain("if (!name)")
  expect(GRID).toContain("onBlur={commit}")
  expect(GRID).toContain('fd.set("name", patch.name)')
  expect(GRID).toContain('method: "PATCH"')
  expect(ACTIONS).toContain("if (parsed.data.name !== undefined) data.name = parsed.data.name")
  expect(ACTIONS).toContain("serviceOrderItem.updateMany({ where: guardedWhere, data })")
})

test("katalog parçaları salt okunur kimlik görünümünü korur", () => {
  const partField = GRID.slice(GRID.indexOf("function PartField("), GRID.indexOf("function QtyStepper("))

  expect(partField).toContain("<PartIdentity row={row} oneLine={oneLine} />")
  expect(GRID).toContain("row.tecdocArticleId != null || row.bakimxProductId != null || row.getirbakimProductId != null")
})
