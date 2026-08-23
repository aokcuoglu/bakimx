import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const MANUAL_DIALOG = readFileSync(
  join(import.meta.dir, "..", "parts", "manual-part-dialog.tsx"),
  "utf8"
)
const QUOTE_EDITOR = readFileSync(
  join(import.meta.dir, "..", "quotes", "quote-items-editor.tsx"),
  "utf8"
)

/**
 * BAK-75 — GİRİLEN TUTAR NET, EKRANDAKİ TUTAR AYNI TUTAR.
 *
 * #311'in "KDV dahil" kipi yazılanı sessizce %20 böler, gösterirken geri
 * çarpardı: ₺100 yazan kullanıcı satırda ₺83,33 okuyordu. Kip kaldırıldı ve
 * sözleşme tersine döndü — KDV yalnız satırın tick'i açıkken, Genel Toplam'a
 * AYRI bir kalem olarak eklenir.
 *
 * Bu sözleşme ne TypeScript'e ne lint'e takılır: net↔brüt çevrimini geri getiren
 * bir düzenleme sessizce eski hatayı diriltir. Bu yüzden kaynak üzerinden
 * korunuyor.
 */

test("kalem fiyatına net↔brüt çevrimi UYGULANMAZ — yazılan tutar olduğu gibi saklanır", () => {
  // Fiyat alanı düz metin girdisidir: yazılan dize `parseTRYToKurus` ile kuruşa
  // çevrilir ve DOĞRUDAN `unitPrice`'a gider — arada KDV kipi yoktur.
  expect(GRID).toContain("parseTRYToKurus(priceDraft)")
  expect(GRID).toContain("evaluateMoneyExpression(priceDraft)")
  expect(GRID).toContain("if (entered !== row.unitPrice) onCell(row, { unitPrice: entered })")
  // Kaldırılan kipin izleri geri gelmesin.
  expect(GRID).not.toContain("toStoredPriceKurus")
  expect(GRID).not.toContain("toDisplayPriceKurus")
  expect(GRID).not.toContain("netFromGrossKurus")
  expect(GRID).not.toContain("grossFromNetKurus")
  expect(MANUAL_DIALOG).not.toContain("toStoredPriceKurus")
  expect(MANUAL_DIALOG).not.toContain("netFromGrossKurus")
})

test("üstteki 'Tutarlar KDV dahil' toplu anahtarı KALDIRILDI", () => {
  // BAK-75 §5 — satır başına tick varken belge geneli bir ikinci anahtar iki
  // ayrı KDV gerçeği yaratıyordu; kaldırıldı ve geri gelmemeli.
  expect(GRID).not.toContain("Tutarlar KDV dahil")
  expect(GRID).not.toContain("PriceTaxToggleRow")
  expect(GRID).not.toContain("allRowsVatLiable")
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
  const priceField = GRID.slice(GRID.indexOf("function PriceField("), GRID.indexOf("function PriceCell("))
  expect(priceField).toContain('data-slot="price-field"')
  expect(priceField).toContain('inputMode="decimal"')
  expect(priceField).not.toContain('type="number"')
})

test("parça miktarı birime göre ondalık girilir ve stok satırında bölünebilir birimler kapalıdır", () => {
  const quantityField = GRID.slice(GRID.indexOf("function QuantityField("), GRID.indexOf("function UnitField("))
  const unitField = GRID.slice(GRID.indexOf("function UnitField("), GRID.indexOf("/** Düzenlemeye açılan taslak"))
  expect(quantityField).toContain('Math.round(quantity * 1000) === quantity * 1000')
  expect(quantityField).toContain('(isDivisibleOrderItemUnit(unit) || Number.isInteger(quantity))')
  expect(quantityField).toContain('inputMode="decimal"')
  expect(unitField).toContain('<OrderItemUnitCombobox')
  expect(unitField).toContain('(row.hasStockLink || !!row.__partId) && isDivisibleOrderItemUnit(candidate)')
})

test("mobil kartta miktar, birim ve birim fiyat aynı kurumsal grid satırındadır", () => {
  const mobile = GRID.slice(GRID.indexOf("function MobilePartRow("))
  expect(mobile).toContain('grid-cols-[4rem_minmax(0,1fr)_6.5rem]')
  expect(mobile).toContain('>Miktar</span>')
  expect(mobile).toContain('>Birim</span>')
  expect(mobile).toContain('>Fiyat</span>')
  expect(mobile).toContain('[&_[data-slot=price-field]]:!w-full')
})

test("BİRİM FİYAT ham `unitPrice`'tır — gösterim çevrimi yok", () => {
  // Gösterim çevrimi olmadığı için alan doğrudan saklanan değeri basar.
  expect(GRID).toContain("row.unitPrice != null ? formatTRY(row.unitPrice)")
  expect(GRID).not.toContain("ed.displayUnitPrice")
  expect(GRID).not.toContain("ed.displayLineTotal")
})

/**
 * BAK-75 takibi — "Toplam" sütunu KDV DAHİL.
 *
 * Net toplam basan sütun, üstteki finansal şeritle tutmuyormuş gibi görünüyordu:
 * 4 satırın her biri ₺100,00 yazarken Genel Toplam ₺480,00 çıkıyordu. Kullanıcının
 * satırda gördüğü tutar cebinden çıkacak tutar olmalı.
 *
 * `ed.lineTotal`'a geri dönen bir düzenleme sessizce eski görünümü diriltir —
 * ne TypeScript ne lint yakalar, o yüzden kaynak üzerinden korunuyor.
 */
test("Toplam sütunu KDV DAHİL tutarı basar — net toplam değil", () => {
  expect(GRID).toContain("const grossLineTotal = lineTotal == null ? null : lineTotal + (vatKurus ?? 0)")
  // Masaüstü satırı, mobil kart ve composer önizlemesi — üçü de brüt okur.
  expect(GRID).not.toContain("lineTotal={ed.lineTotal}")
  const grossUses = GRID.match(/lineTotal=\{ed\.grossLineTotal\}/g) ?? []
  expect(grossUses.length).toBe(3)
})

test("brüt tutarın yanında KDV'nin içinde olduğu YAZAR", () => {
  // Aynı satırda birim fiyat NET, toplam BRÜT duruyor; hangisinin hangisi olduğu
  // rakamdan okunmuyor. Masaüstünde "KDV dahil" etiketi, mobil/composer'da
  // tutarlı not ("₺20,00 KDV dahil") bu ayrımı taşır.
  expect(GRID).toContain("KDV dahil")
  expect(GRID).toContain("<VatHint vatKurus={ed.vatKurus} included />")
})

test("KDV tick'i açılınca satırda KDV tutarı gösterilir VE belgeye oran yazılır", () => {
  // BAK-75 §3 — net tutarın altındaki küçük not.
  expect(GRID).toContain("function VatHint(")
  expect(GRID).toContain("KDV")
  expect(GRID).toContain("lineVatKurus(lineTotal, taxBps)")
  // BAK-75 §2 — belgede oran yokken tick tek başına hiçbir şey yapmazdı:
  // satırda "+₺20,00 KDV" yazarken Genel Toplam'a KDV girmezdi.
  expect(GRID).toContain("if (liable) ensureDocumentTax()")
})

test("teklif tarafında satır KDV tick'i GÖSTERİLMEZ", () => {
  // `QuoteItem`'da `includeVat` kolonu yok: tick kaydedilemez ve teklif
  // toplamına yansımaz. Kaydedilemeyen kontrolü göstermek kullanıcıya yalandır.
  expect(QUOTE_EDITOR).toContain("vatPerLine={false}")
})
