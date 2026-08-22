import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const SOURCE = readFileSync(join(import.meta.dir, "order-item-unit-combobox.tsx"), "utf8")

test("birim menüsü Türkçe etiketlerde arama yapar", () => {
  expect(SOURCE).toContain('placeholder="Birim ara"')
  expect(SOURCE).toContain('toLocaleLowerCase("tr")')
  expect(SOURCE).toContain("Birim bulunamadı")
})

test("devre dışı stok seçeneklerini arama sonuçlarında da korur", () => {
  expect(SOURCE).toContain("disabled={isOptionDisabled?.(unit)}")
})
