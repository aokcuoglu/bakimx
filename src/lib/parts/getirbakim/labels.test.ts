import { describe, expect, test } from "bun:test"
import {
  GETIRBAKIM_SOURCE_LABEL,
  getirbakimDiscountLabel,
  getirbakimFreshnessLabel,
  getirbakimStockLabel,
} from "./labels"
import type { GetirbakimProduct } from "./types"

function product(overrides: Partial<GetirbakimProduct>): GetirbakimProduct {
  return {
    id: "1",
    partNo: "X",
    name: "Balata",
    brandName: "TRW",
    categoryName: null,
    oemNumbers: [],
    imageUrl: null,
    listPriceKurus: 10000,
    b2bPriceKurus: 9000,
    discountBps: 1000,
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 0,
    availability: "UNAVAILABLE",
    lastSyncedAt: null,
    ...overrides,
  }
}

describe("getirbakimStockLabel", () => {
  test("stok varken adedi söyler", () => {
    expect(getirbakimStockLabel(product({ stockQty: 4, availability: "IN_STOCK" }))).toBe("Stok: 4")
  })

  test("stoksuz ama tedarik edilebilir ürün 'Stokta yok' demez", () => {
    expect(getirbakimStockLabel(product({ stockQty: 0, availability: "SUPPLYABLE" }))).toBe(
      "Tedarik edilebilir",
    )
  })

  test("gerçekten yoksa 'Stokta yok'", () => {
    expect(getirbakimStockLabel(product({ stockQty: 0, availability: "UNAVAILABLE" }))).toBe(
      "Stokta yok",
    )
  })
})

describe("getirbakimFreshnessLabel", () => {
  const now = new Date("2026-08-20T12:00:00.000Z")

  test("damga yoksa sessiz kalınmaz", () => {
    expect(getirbakimFreshnessLabel(null, now)).toBe("Güncellik bilinmiyor")
    expect(getirbakimFreshnessLabel("çöp-tarih", now)).toBe("Güncellik bilinmiyor")
  })

  test("dakika, saat ve gün ölçeğinde okunur metin üretir", () => {
    expect(getirbakimFreshnessLabel("2026-08-20T11:45:00.000Z", now)).toBe("15 dk önce güncellendi")
    expect(getirbakimFreshnessLabel("2026-08-20T09:00:00.000Z", now)).toBe("3 sa önce güncellendi")
    expect(getirbakimFreshnessLabel("2026-08-18T12:00:00.000Z", now)).toBe("2 gün önce güncellendi")
  })

  test("çok yeni ve ileri tarihli damga negatif süre yazmaz", () => {
    expect(getirbakimFreshnessLabel("2026-08-20T11:59:30.000Z", now)).toBe("Az önce güncellendi")
    expect(getirbakimFreshnessLabel("2026-08-20T12:05:00.000Z", now)).toBe("Az önce güncellendi")
  })
})

describe("getirbakimDiscountLabel", () => {
  test("iskonto yoksa boş string — satırda not çıkmaz", () => {
    expect(getirbakimDiscountLabel(0)).toBe("")
    expect(getirbakimDiscountLabel(-5)).toBe("")
  })

  test("kaynağı BakımX değil GetirBakım olarak söyler", () => {
    const label = getirbakimDiscountLabel(1500)
    expect(label).toBe(`%15 ${GETIRBAKIM_SOURCE_LABEL} iskontosu uygulandı`)
    expect(label).not.toContain("BakımX iskontosu")
  })
})
