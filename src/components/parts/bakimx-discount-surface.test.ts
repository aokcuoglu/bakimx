import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BakimxProductRow } from "./bakimx-product-row"
import { TecdocArticleRow } from "./tecdoc-article-row"
import { bakimxLineItemFields } from "@/lib/parts/bakimx-item"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { ArticleSummary } from "@/lib/tecdoc/types"

/**
 * BAK-58 — atölye iskontosunun GÖSTERİM yüzeylerine bağlanması.
 *
 * BAK-47 iskontoyu `displayPriceKurus`'a hesaplıyordu ama o alanı okuyan tek bir
 * tüketici yoktu: %15 tanımlanan atölyenin ne gördüğü ne ödediği değişiyordu.
 * PR #352'de 61 test yeşildi çünkü hepsi DTO alanının DEĞERİNİ doğruluyordu, o
 * alanın OKUNDUĞUNU değil. Bu dosya boşluğu tüketici katmanında kapatır:
 * bileşenler gerçekten render edilir ve çıkan metin üzerinden doğrulanır.
 *
 * Sözleşme:
 *  1. Atölye yüzeyi `displayPriceKurus` basar — liste fiyatı (`workshopPriceKurus`)
 *     yalnız BakımX'in kendi katalog yönetiminde (`/admin/catalog`) görünür.
 *  2. İskonto varsa küçük bir not çıkar; üstü çizili liste fiyatı GÖSTERİLMEZ.
 *  3. `discountBps = 0` atölyede dört yüzey de bugünküyle birebir aynı davranır.
 */

const product = (over: Partial<BakimxProductSummary> = {}): BakimxProductSummary => ({
  id: "bx-1",
  sku: "C 27 125",
  name: "Akü 60Ah 540A",
  brandId: "brand-1",
  brandName: "Mutlu",
  categoryKey: "aku",
  categoryLabel: "Akü",
  barcode: null,
  unit: "adet",
  description: null,
  imageUrl: null,
  oemNumbers: [],
  workshopPriceKurus: 5_000,
  displayPriceKurus: 5_000,
  discountBps: 0,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 4,
  backorderable: false,
  leadTimeDays: null,
  ...over,
})

/** %15 iskontolu atölyenin gördüğü ürün: liste ₺50,00 → ödenen ₺42,50. */
const discounted = product({ displayPriceKurus: 4_250, discountBps: 1500 })

const article: ArticleSummary = {
  tecdocArticleId: 1,
  articleNo: "0 986 4B7 035",
  productName: "Akü",
  supplierName: "Bosch",
  supplierId: null,
  imageUrl: null,
}

const renderProductRow = (p: BakimxProductSummary) =>
  renderToStaticMarkup(createElement(BakimxProductRow, { product: p, onSelect: () => {} }))

const renderTecdocRow = (p: BakimxProductSummary | null) =>
  renderToStaticMarkup(createElement(TecdocArticleRow, { article, bakimxMatch: p, onSelect: () => {} }))

const SEARCH_INPUT = readFileSync(join(import.meta.dir, "part-search-input.tsx"), "utf8")
const PRODUCT_ROW_SRC = readFileSync(join(import.meta.dir, "bakimx-product-row.tsx"), "utf8")
const TECDOC_ROW_SRC = readFileSync(join(import.meta.dir, "tecdoc-article-row.tsx"), "utf8")

test("ürün satırı: iskontolu atölyede iskontolu tutar ve not görünür", () => {
  const html = renderProductRow(discounted)
  expect(html).toContain("Alış: ₺42,50")
  expect(html).toContain("%15 BakımX iskontosu uygulandı")
  // Liste fiyatı hiçbir biçimde ekrana çıkmaz — üstü çizili de gösterilmez.
  expect(html).not.toContain("₺50,00")
  expect(html).not.toContain("line-through")
})

test("ürün satırı: iskontosuz atölyede çıktı bugünküyle birebir aynı", () => {
  const html = renderProductRow(product())
  expect(html).toContain("Alış: ₺50,00")
  expect(html).not.toContain("iskonto")
})

test("TecDoc rozeti: iskontolu atölyede iskontolu tutar ve not görünür", () => {
  const html = renderTecdocRow(discounted)
  expect(html).toContain("₺42,50")
  expect(html).toContain("%15 BakımX iskontosu uygulandı")
  expect(html).not.toContain("₺50,00")
  expect(html).not.toContain("line-through")
})

test("TecDoc rozeti: iskontosuz atölyede çıktı bugünküyle birebir aynı", () => {
  const html = renderTecdocRow(product())
  expect(html).toContain("₺50,00")
  expect(html).not.toContain("iskonto")
})

test("TecDoc satırı: BakımX eşleşmesi yoksa rozet hiç çıkmaz", () => {
  const html = renderTecdocRow(null)
  expect(html).not.toContain("₺")
  expect(html).not.toContain("iskonto")
})

/**
 * Arama açılır listesi bir `Autocomplete` render prop'unun içindedir — açık
 * durumu istemci etkileşimi gerektirdiği için statik render'a çıkmaz. Repo'nun
 * bileşen sözleşmesi kalıbıyla (bkz. components/orders/parts-labor-price-tax
 * .test.ts) kaynak üzerinden korunur.
 */
test("arama açılır listesi iskontolu tutarı okur, liste fiyatını değil", () => {
  expect(SEARCH_INPUT).toContain("formatTRY(s.product.displayPriceKurus)")
  expect(SEARCH_INPUT).not.toMatch(/formatTRY\(s\.product\.workshopPriceKurus\)/)
  expect(SEARCH_INPUT).toContain("formatDiscountLabel(s.product.discountBps)")
  expect(SEARCH_INPUT).not.toContain("line-through")
})

test("hiçbir atölye yüzeyi liste fiyatını basmaz", () => {
  for (const src of [SEARCH_INPUT, PRODUCT_ROW_SRC, TECDOC_ROW_SRC]) {
    expect(src).not.toMatch(/formatTRY\([^)]*workshopPriceKurus\)/)
  }
})

/**
 * Asıl kabul: kullanıcının GÖRDÜĞÜ tutar ile kaleme YAZILAN tutar aynı olmalı.
 * Üç yüzey ve kalem yazımı tek kaynaktan (`displayPriceKurus`) beslendiği için
 * bu eşitlik alan seçimiyle korunur.
 */
test("gösterilen tutar ile kaleme yazılan tutar aynıdır", () => {
  const fields = bakimxLineItemFields(discounted)
  expect(fields.purchasePriceKurus).toBe(discounted.displayPriceKurus)
  expect(renderProductRow(discounted)).toContain("₺42,50")
  expect(renderTecdocRow(discounted)).toContain("₺42,50")
})
