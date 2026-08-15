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
  // Grid'in fiyat alanı düz metin girdisidir (bkz. aşağıdaki test): kullanıcının
  // yazdığı dize `parseTRYToKurus` ile kuruşa çevrilir, sonra KDV kipinden geçer.
  expect(GRID).toContain("toStoredPriceKurus(entered")
  expect(MANUAL_DIALOG).toContain("toStoredPriceKurus(liraToKurus(lira)")
  // Ham lira/dize→kuruş çevrimi doğrudan bir kalem fiyatına yazılmamalı.
  expect(GRID).not.toMatch(/unitPrice:\s*liraToKurus\(/)
  expect(GRID).not.toMatch(/unitPrice:\s*parseTRYToKurus\(/)
  expect(MANUAL_DIALOG).not.toMatch(/unitPrice\s*=\s*[^\n]*\?\s*liraToKurus\(/)
})

/**
 * BAK-53 geri bildirimi — Birim Fiyat alanı `type="number"` DEĞİL.
 *
 * Sayı girdisi dar hücrede tarayıcı oklarını basıyor, tekerlek/ok tuşuyla fiyatı
 * kazara değiştiriyor ve Türkçe klavyeyle yazılan "120,50" tarayıcı tarafından
 * geçersiz sayılıp `value` olarak BOŞ dizeye düşüyordu — yani kuruşlu fiyat
 * sessizce kaybediliyordu. Alan düz `Input` + `parseTRYToKurus` ile çalışır.
 */
test("Birim Fiyat alanı sayı girdisi değil, virgüllü girişi okuyan metin alanıdır", () => {
  const priceField = GRID.slice(GRID.indexOf("function PriceField("), GRID.indexOf("function TotalField("))
  expect(priceField).toContain('data-slot="price-field"')
  expect(priceField).toContain('inputMode="decimal"')
  expect(priceField).not.toContain('type="number"')
  expect(GRID).toContain("parseTRYToKurus(priceDraft)")
})

test("birim fiyat ve satır toplamı gösterim çevriminden okunur", () => {
  // Satır/kart/composer üçü de ed.displayUnitPrice / ed.displayLineTotal okur;
  // ham row.unitPrice veya ed.lineTotal doğrudan ekrana basılmaz.
  expect(GRID).not.toMatch(/lineTotal=\{ed\.lineTotal\}/)
  expect(GRID).not.toMatch(/formatTRY\(row\.unitPrice\)/)
  expect(GRID).toContain("ed.displayUnitPrice")
  expect(GRID).toContain("ed.displayLineTotal")
})
