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
  expect(grid).toContain("plain")
  // #888: arama ve işçilik alanları ölçüyü/görünümü Input'tan alır, ezmez.
  expect(grid).not.toContain("inputClassName")
  expect(grid).not.toContain("bg-background text-sm")
})

test("ortak diyalog viewport dışına taşmadan açılır", () => {
  expect(dialog).toContain("max-h-[calc(100dvh-2rem)]")
  expect(dialog).toContain("overflow-y-auto")
})

test("Kalemi düzenle diyaloğu ilk odağı düzenlenebilir alana verir (kaynak rozeti tooltip'i açmaz)", () => {
  const editDialog = grid.slice(grid.indexOf("<DialogTitle>Kalemi düzenle"))
  const open = grid.slice(grid.lastIndexOf("<DialogContent", grid.indexOf("<DialogTitle>Kalemi düzenle")), grid.indexOf("<DialogTitle>Kalemi düzenle"))
  expect(editDialog.length).toBeGreaterThan(0)
  expect(open).toContain("onOpenAutoFocus={focusFirstEditableField}")
  expect(open).toContain("ref={editDialogRef}")
  // Escape korumasını çağrı yerinde kopyalama — paylaşılan Dialog yapıyor.
  expect(open).not.toContain("onEscapeKeyDown")
})
