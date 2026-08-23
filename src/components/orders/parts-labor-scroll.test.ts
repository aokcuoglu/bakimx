import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const grid = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const dialog = readFileSync(join(import.meta.dir, "../ui/dialog.tsx"), "utf8")

test("kalem listesi yükseklik sınırında sayfa kaydırmasını serbest bırakır", () => {
  const scrollClass = grid.match(/const ITEM_LIST_SCROLL = "([^"]+)"/)?.[1]
  expect(scrollClass).toBe("max-h-[26rem] overflow-y-auto")
  expect(scrollClass).not.toContain("overscroll-contain")
  expect(grid).toContain('containerClassName={ITEM_LIST_SCROLL}')
  expect(grid).toContain('rows.length > 0 && ITEM_LIST_SCROLL')
  expect(grid).not.toContain("Yeni kalem ekle")
  expect(grid).toContain('inputClassName="bg-background"')
  expect(grid).toContain("plain")
  expect(grid).toContain('className="h-8 rounded-lg bg-background text-sm"')
})

test("ortak diyalog viewport dışına taşmadan açılır", () => {
  expect(dialog).toContain("max-h-[calc(100dvh-2rem)]")
  expect(dialog).toContain("overflow-y-auto")
})
