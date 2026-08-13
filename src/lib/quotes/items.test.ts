import { expect, test } from "bun:test"
import { quoteItemToRow, rowToQuoteItem, rowsToQuoteItems, toQuoteItemType, type QuoteEditorRow } from "@/lib/quotes/items"
import { calculateOrderTotals } from "@/lib/totals"

function row(over: Partial<QuoteEditorRow> = {}): QuoteEditorRow {
  return {
    id: "q0", type: "part", name: "Fren balatası", sku: "P-1", unit: "adet",
    quantity: 2, unitPrice: 15000, totalPrice: null, note: null, partId: null,
    bakimxProductId: null, ...over,
  }
}

test("satır → teklif kalemi: para kuruş tamsayısı olarak taşınır", () => {
  const item = rowToQuoteItem(row({ unitPrice: 15000, totalPrice: 30000 }))
  expect(item.unitPrice).toBe(15000)
  expect(item.totalPrice).toBe(30000)
  expect(item.sku).toBe("P-1")
  expect(item.unit).toBe("adet")
})

test("fiyatsız satırda tutarlar null kalır (önceki satırın fiyatı yapışmaz)", () => {
  const item = rowToQuoteItem(row({ unitPrice: null, totalPrice: null }))
  expect(item.unitPrice).toBeNull()
  expect(item.totalPrice).toBeNull()
})

test("sıfır fiyat null'a düşer — tutar girilmemiş sayılır", () => {
  const item = rowToQuoteItem(row({ unitPrice: 0, totalPrice: 0 }))
  expect(item.unitPrice).toBeNull()
  expect(item.totalPrice).toBeNull()
})

test("stok kartı bağı korunur — teklif kalemi partId taşıyabilir", () => {
  expect(rowToQuoteItem(row({ partId: "part-7" })).partId).toBe("part-7")
  expect(rowToQuoteItem(row({ partId: null })).partId).toBe("")
})

/**
 * BAK-35 — BakımX bağı teklif satırında yaşar ve `partId`'den AYRI durur: stok
 * bağı kuran alan partId'dir, BakımX ürünü hiçbir aşamada stok hareketi doğurmaz.
 */
test("BakımX bağı taşınır ve stok bağıyla karışmaz", () => {
  const item = rowToQuoteItem(row({ bakimxProductId: "bx-1" }))
  expect(item.bakimxProductId).toBe("bx-1")
  expect(item.partId).toBe("")
  expect(rowToQuoteItem(row({ bakimxProductId: null })).bakimxProductId).toBe("")
  expect(quoteItemToRow(item, "q9").bakimxProductId).toBe("bx-1")
})

test("adsız satırlar teklife yazılmaz", () => {
  const items = rowsToQuoteItems([row(), row({ id: "q1", name: "   " }), row({ id: "q2", name: "Yağ" })])
  expect(items.map((i) => i.name)).toEqual(["Fren balatası", "Yağ"])
})

test("dış işçilik teklif tipine daraltılır", () => {
  expect(toQuoteItemType("external_labor")).toBe("part")
  expect(toQuoteItemType("labor")).toBe("labor")
  expect(toQuoteItemType("part")).toBe("part")
})

test("gidiş-dönüş dönüşüm kaybı yok", () => {
  const original = row({ type: "labor", sku: null, unitPrice: 45000, totalPrice: 90000, note: "acele", partId: "p1" })
  const back = quoteItemToRow(rowToQuoteItem(original), "q0")
  expect(back).toEqual({ ...original, sku: null })
})

test("kalem toplamı: açık tutar yoksa birim fiyat × miktar", () => {
  const items = rowsToQuoteItems([
    row({ id: "q0", type: "part", unitPrice: 15000, quantity: 2, totalPrice: null }),
    row({ id: "q1", type: "labor", name: "İşçilik", unitPrice: 20000, quantity: 1, totalPrice: null }),
  ])
  const totals = calculateOrderTotals(
    items.map((i) => ({ type: i.type, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
    { discountAmount: 5000, taxRate: 2000 }
  )
  expect(totals.partsTotal).toBe(30000)
  expect(totals.laborTotal).toBe(20000)
  expect(totals.subtotal).toBe(50000)
  // (50000 - 5000) * %20 = 9000 → 45000 + 9000
  expect(totals.taxAmount).toBe(9000)
  expect(totals.grandTotal).toBe(54000)
})

test("açık tutar girilmişse birim fiyat × miktar yerine o kullanılır", () => {
  const items = rowsToQuoteItems([row({ unitPrice: 15000, quantity: 2, totalPrice: 25000 })])
  const totals = calculateOrderTotals(
    items.map((i) => ({ type: i.type, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
  )
  expect(totals.partsTotal).toBe(25000)
})
