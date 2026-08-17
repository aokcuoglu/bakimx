import { test, expect } from "bun:test"
import {
  findUnmarkedUpItems,
  needsMarkup,
  purchaseMarginHint,
  purchaseMarginKurus,
  purchaseMarginNoticeMessage,
  purchaseMarginPercent,
  purchaseMarginState,
  showsPurchaseCost,
} from "./purchase-margin"

const item = (unitPrice: number | null, purchasePriceKurus?: number | null) => ({ unitPrice, purchasePriceKurus })

test("alış fiyatı olmayan kalem karşılaştırma dışıdır", () => {
  expect(purchaseMarginState(item(50000))).toBe("none")
  expect(purchaseMarginState(item(50000, null))).toBe("none")
})

test("alış fiyatı 0 ise uyarı verilmez (bedelsiz/garanti parça)", () => {
  expect(purchaseMarginState(item(0, 0))).toBe("none")
  expect(purchaseMarginState(item(50000, 0))).toBe("none")
})

test("dış alım kalemi ön-doldurulmuş haliyle 'at-cost'tur", () => {
  // addPurchaseItemAction: unitPrice = purchasePriceKurus
  expect(purchaseMarginState(item(30000, 30000))).toBe("at-cost")
})

test("satış alışın altındaysa 'below-cost'", () => {
  expect(purchaseMarginState(item(29999, 30000))).toBe("below-cost")
})

test("satış alışın üstündeyse 'marked-up'", () => {
  expect(purchaseMarginState(item(30001, 30000))).toBe("marked-up")
})

test("alış var ama satış girilmemişse 'unpriced' — marj uyarısı verilmez", () => {
  const state = purchaseMarginState(item(null, 30000))
  expect(state).toBe("unpriced")
  expect(needsMarkup(state)).toBe(false)
  // Alış fiyatı yine de gösterilir.
  expect(showsPurchaseCost(state)).toBe(true)
})

test("uyarı rengi yalnız at-cost ve below-cost için", () => {
  expect(needsMarkup("at-cost")).toBe(true)
  expect(needsMarkup("below-cost")).toBe(true)
  expect(needsMarkup("marked-up")).toBe(false)
  expect(needsMarkup("none")).toBe(false)
})

test("alış fiyatı revize edildikten SONRA da görünür kalır", () => {
  expect(showsPurchaseCost(purchaseMarginState(item(45000, 30000)))).toBe(true)
  expect(showsPurchaseCost("none")).toBe(false)
})

test("kâr kuruşu ve yüzdesi maliyet üzerinden hesaplanır", () => {
  expect(purchaseMarginKurus(item(40000, 30000))).toBe(10000)
  expect(purchaseMarginPercent(item(40000, 30000))).toBe(33)
  expect(purchaseMarginKurus(item(30000, 30000))).toBe(0)
  expect(purchaseMarginPercent(item(30000, 30000))).toBe(0)
})

test("zararına kalemde kâr negatif döner", () => {
  expect(purchaseMarginKurus(item(24000, 30000))).toBe(-6000)
  expect(purchaseMarginPercent(item(24000, 30000))).toBe(-20)
})

test("kıyas yapılamayan kalemde kâr null", () => {
  expect(purchaseMarginKurus(item(null, 30000))).toBeNull()
  expect(purchaseMarginKurus(item(40000, null))).toBeNull()
  expect(purchaseMarginPercent(item(40000, 0))).toBeNull()
})

test("hint metni duruma göre değişir, none/unpriced'da yoktur", () => {
  expect(purchaseMarginHint("at-cost")).toContain("kâr")
  expect(purchaseMarginHint("below-cost")).toContain("zararına")
  expect(purchaseMarginHint("marked-up")).toContain("alış fiyatı")
  expect(purchaseMarginHint("none")).toBeNull()
  expect(purchaseMarginHint("unpriced")).toBeNull()
})

test("liste süzgeci sırayı korur ve yalnız uyarılıkları döner", () => {
  const rows = [
    { id: "1", ...item(40000, 30000) },
    { id: "2", ...item(30000, 30000) },
    { id: "3", ...item(50000) },
    { id: "4", ...item(20000, 30000) },
  ]
  expect(findUnmarkedUpItems(rows).map((r) => r.id)).toEqual(["2", "4"])
})

test("toplu uyarı metni sayıyı ve zarar durumunu ayrı yazar", () => {
  expect(purchaseMarginNoticeMessage([item(40000, 30000)])).toBeNull()
  const msg = purchaseMarginNoticeMessage([item(30000, 30000), item(20000, 30000)])
  expect(msg).toContain("2 kalemin")
  expect(msg).toContain("1 kalem alış fiyatının ALTINDA")
  const onlyAtCost = purchaseMarginNoticeMessage([item(30000, 30000)])
  expect(onlyAtCost).toContain("1 kalemin")
  expect(onlyAtCost).not.toContain("ALTINDA")
})
