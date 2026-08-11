import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const MANUAL_DIALOG = readFileSync(
  join(import.meta.dir, "..", "parts", "manual-part-dialog.tsx"),
  "utf8"
)

/**
 * #311 — kalem düzenleyicisi KDV dahil/hariç kipiyle çalışır ama VERİTABANINA
 * yazılan `unitPrice` her koşulda NET kalır (KDV tek noktada, belgenin
 * `taxRate`'i ile Genel Toplam'a eklenir — bkz. src/lib/totals.ts).
 *
 * Buradaki sözleşme ne TypeScript'e ne lint'e takılır: kipi atlayıp yazılan
 * lirayı doğrudan `unitPrice`'a koyan bir düzenleme, KDV dahil kipinde tutarları
 * sessizce %20 şişirir. Bu yüzden kaynak üzerinden korunur.
 */

test("yazılan fiyat kalıcılaşmadan önce KDV kipinden geçer", () => {
  expect(GRID).toContain("toStoredPriceKurus(liraToKurus(lira)")
  expect(MANUAL_DIALOG).toContain("toStoredPriceKurus(liraToKurus(lira)")
  // Ham lira→kuruş çevrimi doğrudan bir kalem fiyatına yazılmamalı.
  expect(GRID).not.toMatch(/unitPrice:\s*liraToKurus\(/)
  expect(MANUAL_DIALOG).not.toMatch(/unitPrice\s*=\s*[^\n]*\?\s*liraToKurus\(/)
})

test("birim fiyat ve satır toplamı gösterim çevriminden okunur", () => {
  // Satır/kart/composer üçü de ed.displayUnitPrice / ed.displayLineTotal okur;
  // ham row.unitPrice veya ed.lineTotal doğrudan ekrana basılmaz.
  expect(GRID).not.toMatch(/lineTotal=\{ed\.lineTotal\}/)
  expect(GRID).not.toMatch(/formatTRY\(row\.unitPrice\)/)
  expect(GRID).toContain("ed.displayUnitPrice")
  expect(GRID).toContain("ed.displayLineTotal")
})
