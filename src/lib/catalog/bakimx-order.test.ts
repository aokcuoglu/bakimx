import { describe, expect, it } from "bun:test"
import {
  BAKIMX_ORDER_STATUSES,
  bakimxOrderDecrementsStock,
  bakimxOrderItemSnapshot,
  bakimxOrderStockShortfall,
  bakimxOrderTotalKurus,
  bakimxOrderTransitionError,
  bakimxOrderTransitions,
  canTransitionBakimxOrder,
  isBakimxOrderOpen,
  type BakimxOrderStatusValue,
} from "./bakimx-order"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

/**
 * BAK-60 — sipariş talebi akışının SAF kuralları.
 *
 * Buradaki testler DB'siz çalışır çünkü korudukları şey veritabanı değil karar:
 * hangi geçiş meşru, hangi geçiş stok düşürür ve kaleme hangi tutar donar.
 * Yazma yolları (route + admin action) bu fonksiyonları çağırdığı için kural tek
 * yerde doğrulanmış olur.
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

describe("durum geçişleri", () => {
  it("requested yalnız confirmed veya cancelled'a gider", () => {
    expect(bakimxOrderTransitions("requested")).toEqual(["confirmed", "cancelled"])
  })

  /**
   * Sevkiyat stok düşüren TEK geçiş; önünde açık bir onay adımı durması bilinçli.
   */
  it("requested → shipped doğrudan yapılamaz", () => {
    expect(canTransitionBakimxOrder("requested", "shipped")).toBe(false)
    expect(canTransitionBakimxOrder("confirmed", "shipped")).toBe(true)
  })

  it("shipped ve cancelled terminaldir", () => {
    expect(isBakimxOrderOpen("shipped")).toBe(false)
    expect(isBakimxOrderOpen("cancelled")).toBe(false)
    for (const status of BAKIMX_ORDER_STATUSES) {
      expect(canTransitionBakimxOrder("shipped", status)).toBe(false)
      expect(canTransitionBakimxOrder("cancelled", status)).toBe(false)
    }
  })

  /** İnvaryant 5: iptal ancak sevkiyattan önce mümkündür. */
  it("iptal yalnız shipped öncesinde mümkündür", () => {
    expect(canTransitionBakimxOrder("requested", "cancelled")).toBe(true)
    expect(canTransitionBakimxOrder("confirmed", "cancelled")).toBe(true)
    expect(canTransitionBakimxOrder("shipped", "cancelled")).toBe(false)
  })

  it("aynı duruma geçiş reddedilir", () => {
    for (const status of BAKIMX_ORDER_STATUSES) {
      expect(canTransitionBakimxOrder(status, status)).toBe(false)
    }
  })

  it("her reddedilen geçiş okunur bir gerekçe döner", () => {
    for (const from of BAKIMX_ORDER_STATUSES) {
      for (const to of BAKIMX_ORDER_STATUSES) {
        if (canTransitionBakimxOrder(from, to)) continue
        expect(bakimxOrderTransitionError(from, to).length).toBeGreaterThan(10)
      }
    }
  })
})

describe("stok düşümü kararı", () => {
  /** İnvaryant 2: stok yalnız `shipped` geçişinde düşer. */
  it("yalnız shipped geçişi stok düşürür", () => {
    const pairs: [BakimxOrderStatusValue, BakimxOrderStatusValue][] = [
      ["requested", "confirmed"],
      ["requested", "cancelled"],
      ["confirmed", "cancelled"],
    ]
    for (const [from, to] of pairs) {
      expect(bakimxOrderDecrementsStock(from, to)).toBe(false)
    }
    expect(bakimxOrderDecrementsStock("confirmed", "shipped")).toBe(true)
  })

  /**
   * İnvaryant 3'ün saf yarısı: zaten `shipped` olan bir sipariş yeniden
   * işaretlenirse ikinci düşüm YOKTUR. (Diğer yarısı admin action'ındaki koşullu
   * `updateMany` — bkz. actions.test.ts.)
   */
  it("zaten shipped olan sipariş ikinci kez düşürmez", () => {
    expect(bakimxOrderDecrementsStock("shipped", "shipped")).toBe(false)
  })
})

describe("kalem anlık görüntüsü", () => {
  /** İnvaryant 1: kaleme yazılan tutar sunucunun çözdüğü İSKONTOLU fiyattır. */
  it("iskontolu fiyat kaleme, liste fiyatı açıklamaya donar", () => {
    const discounted = product({ displayPriceKurus: 4_250, discountBps: 1500 })
    const snapshot = bakimxOrderItemSnapshot(discounted, 3)

    expect(snapshot.unitPriceKurus).toBe(4_250)
    expect(snapshot.listPriceKurus).toBe(5_000)
    expect(snapshot.discountBps).toBe(1500)
    expect(snapshot.quantity).toBe(3)
  })

  it("ad ve SKU kaleme kopyalanır — ürün kartı sonradan değişse de", () => {
    const snapshot = bakimxOrderItemSnapshot(product(), 1)
    expect(snapshot.nameSnapshot).toBe("Akü 60Ah 540A")
    expect(snapshot.skuSnapshot).toBe("C 27 125")
    expect(snapshot.bakimxProductId).toBe("bx-1")
  })

  it("iskontosuz atölyede iki fiyat da aynıdır", () => {
    const snapshot = bakimxOrderItemSnapshot(product(), 2)
    expect(snapshot.unitPriceKurus).toBe(snapshot.listPriceKurus)
    expect(snapshot.discountBps).toBe(0)
  })
})

describe("toplam ve stok uyarısı", () => {
  it("toplam adet × birim fiyat, kuruş tam sayısı", () => {
    expect(
      bakimxOrderTotalKurus([
        { quantity: 3, unitPriceKurus: 4_250 },
        { quantity: 1, unitPriceKurus: 1_850 },
      ]),
    ).toBe(14_600)
    expect(bakimxOrderTotalKurus([])).toBe(0)
  })

  it("stok yeterliyse eksik 0, değilse aradaki fark", () => {
    expect(bakimxOrderStockShortfall({ quantity: 2, stockQty: 5 })).toBe(0)
    expect(bakimxOrderStockShortfall({ quantity: 5, stockQty: 2 })).toBe(3)
    expect(bakimxOrderStockShortfall({ quantity: 1, stockQty: 0 })).toBe(1)
  })

  /** Ürün kartı silinmişse karşılaştıracak stok yok — uyarı üretme. */
  it("ürün bulunamadıysa uyarı üretilmez", () => {
    expect(bakimxOrderStockShortfall({ quantity: 5, stockQty: null })).toBe(0)
  })
})
