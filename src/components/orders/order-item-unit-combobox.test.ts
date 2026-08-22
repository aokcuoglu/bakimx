import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const SOURCE = readFileSync(join(import.meta.dir, "order-item-unit-combobox.tsx"), "utf8")

test("birim menüsü Türkçe etiketlerde arama yapar", () => {
  expect(SOURCE).toContain('placeholder="Birim ara..."')
  expect(SOURCE).toContain('toLocaleLowerCase("tr")')
  expect(SOURCE).toContain("Birim bulunamadı")
})

test("devre dışı stok seçeneklerini arama sonuçlarında da korur", () => {
  expect(SOURCE).toContain("const disabled = isOptionDisabled?.(unit)")
})

test("kapalı durumda eski select görünümünü, açılınca ayrı arama alanını kullanır", () => {
  expect(SOURCE).toContain('<PopoverTrigger asChild>')
  expect(SOURCE).toContain('variant="outline"')
  expect(SOURCE).toContain('<PopoverContent align="start" className="w-56 gap-1.5 p-1.5">')
})
