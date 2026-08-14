import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { bakimxLineItemFields, bakimxStockLabel } from "./bakimx-item"
import type { BakimxProductSummary } from "./bakimx-catalog"

/**
 * BAK-35 — BakımX kaleminin YAZIM invaryantları. En kritiği: BakımX ürünü eklemek
 * ATÖLYE STOĞUNU HAREKET ETTİRMEZ. Stok düşümünü tetikleyen tek alan `partId`
 * (bkz. addOrderItemAction → reserveStockInTx) ve BakımX kaleminde o alan
 * daima boştur; BakımX stoğu global bir havuzdur, atölyenin envanteri değildir.
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
  workshopPriceKurus: 248_000,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 3,
  backorderable: false,
  leadTimeDays: null,
  ...over,
})

test("kalem stok kartına BAĞLANMAZ — stok düşümü tetiklenmez", () => {
  const fields = bakimxLineItemFields(product())
  expect(fields.partId).toBeNull()
  expect(Object.keys(fields)).not.toContain("__partId")
})

test("categoryId null kalır — TecDoc düğüm id kolonuna iç taksonomi yazılmaz", () => {
  const fields = bakimxLineItemFields(product())
  expect(fields.categoryId).toBeNull()
  // Kategori YALNIZ serbest metin alanına, okunur etiketiyle gider.
  expect(fields.category).toBe("Akü")
})

test("kategorisiz üründe kategori metni de boş kalır", () => {
  expect(bakimxLineItemFields(product({ categoryKey: null, categoryLabel: null })).category).toBeNull()
})

test("fiyat alışa yazılır, satış fiyatı ondan ÖN-DOLDURULUR", () => {
  const fields = bakimxLineItemFields(product({ workshopPriceKurus: 248_000 }))
  // İkisi ayrı alan: atölye unitPrice'ı kendi marjıyla düzenler, alış donmuş kalır.
  expect(fields.purchasePriceKurus).toBe(248_000)
  expect(fields.unitPrice).toBe(248_000)
})

test("kimlik ve kaynak alanları üründen gelir", () => {
  const fields = bakimxLineItemFields(product())
  expect(fields).toMatchObject({
    source: "bakimx",
    bakimxProductId: "bx-1",
    name: "Akü 60Ah 540A",
    sku: "C 27 125",
    brand: "Mutlu",
    unit: "adet",
  })
})

test("dış alım tedarikçi alanları YAZILMAZ", () => {
  const keys = Object.keys(bakimxLineItemFields(product()))
  expect(keys).not.toContain("supplierName")
  expect(keys).not.toContain("supplierId")
})

test("stok rozeti: adet, siparişe açık, stokta yok", () => {
  expect(bakimxStockLabel(product({ stockQty: 3 }))).toBe("Stok: 3 adet")
  expect(bakimxStockLabel(product({ stockQty: 0, backorderable: true }))).toBe("Siparişe açık")
  expect(bakimxStockLabel(product({ stockQty: 0, backorderable: true, leadTimeDays: 5 }))).toBe(
    "Siparişe açık · 5 gün",
  )
  expect(bakimxStockLabel(product({ stockQty: 0, backorderable: false }))).toBe("Stokta yok")
})

/**
 * Tip sistemi `partId: null`'ı garantiliyor ama sunucu o alanı istemciden GELEN
 * `partId` ile de doldurabilirdi. Bu kaynak taraması (bkz. quote-stock-invariant
 * .test.ts, aynı desen) yazma yolunda BakımX kaleminin stok bağını ve stok
 * çağrısını dışarıda bıraktığını zorunlu kılar.
 */
test("addOrderItemAction BakımX kaleminde partId bağlamaz ve stok düşmez", () => {
  const source = readFileSync(
    join(import.meta.dir, "..", "..", "app", "(app)", "orders", "actions.ts"),
    "utf8",
  )
  const start = source.indexOf("export async function addOrderItemAction(")
  expect(start, "addOrderItemAction bulunamadı").toBeGreaterThan(-1)
  const body = source.slice(start).split("\nexport ")[0]

  // Kalem satırında partId, BakımX alanları çözüldüyse null'a düşer.
  expect(body).toContain("partId: bakimxFields ? null : partId")
  // Stok rezervasyonu BakımX kaleminde hiç çağrılmaz.
  expect(body).toContain("if (!bakimxFields && partId && parsed.data.type === \"part\")")
  // Fiyat ve kimlik istemciden değil, DB'den okunan üründen türetilir.
  expect(body).toContain("getVisibleBakimxProduct(")
  expect(body).toContain("bakimxLineItemFields(product)")
})
