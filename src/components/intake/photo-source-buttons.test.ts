import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (...p: string[]) => readFileSync(join(import.meta.dir, ...p), "utf8")
const BUTTONS = read("photo-source-buttons.tsx")
const ANNOTATE = read("photo-annotate.tsx")
const DETAIL = read("..", "orders", "work-order-detail.tsx")

/**
 * #899 — PC'de `capture` yok sayılır; Kamera ve Galeri aynı dosya seçiciyi
 * açıyordu. Fare cihazında tek "Dosyadan seç", dokunmatikte Kamera / Galeri.
 * Ayrım CSS medya sorgusuyla (hidrasyon farkı yok), JS dalı değil.
 */
test("dokunmatikte Kamera / Galeri, farede tek Dosyadan seç (CSS ile)", () => {
  expect(BUTTONS).toContain('className="grid grid-cols-2 gap-2 pointer-fine:hidden"')
  expect(BUTTONS).toContain('className="hidden pointer-fine:grid"')
  expect(BUTTONS).toContain("<Camera /> Kamera")
  expect(BUTTONS).toContain("<Images /> Galeri")
  expect(BUTTONS).toContain("<Upload /> Dosyadan seç")
  expect(BUTTONS).not.toContain("matchMedia")
})

/** #886 — uzun etiket telefonda 44px düğmeye sığmıyordu; geri dönmez. */
test("iki ekran ortak bileşeni kullanır, uzun etiket geri gelmez", () => {
  for (const src of [ANNOTATE, DETAIL]) {
    expect(src).toContain("<PhotoSourceButtons")
    expect(src).not.toContain("Galeriden seç")
    expect(src).not.toContain("Foto çek")
  }
})
