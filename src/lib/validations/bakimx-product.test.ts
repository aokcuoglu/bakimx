import { describe, expect, test } from "bun:test"
import {
  BULK_SELECTION_LIMIT,
  bakimxBrandInputSchema,
  bakimxBulkActiveSchema,
  bakimxBulkPriceSchema,
  bakimxBulkStockSchema,
  bakimxProductInputSchema,
} from "@/lib/validations/bakimx-product"

function productInput(overrides: Record<string, unknown> = {}) {
  return {
    sku: "MUTLU-60AH",
    name: "Mutlu Akü 60 Ah",
    brandId: "brand_1",
    workshopPriceKurus: 250000,
    vatRateBps: 2000,
    ...overrides,
  }
}

describe("ürün giriş şeması (sunucu katmanı)", () => {
  test("zorunlu alanlarla geçer ve varsayılanları doldurur", () => {
    const parsed = bakimxProductInputSchema.safeParse(productInput())
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.unit).toBe("adet")
    expect(parsed.data.stockQty).toBe(0)
    expect(parsed.data.isActive).toBe(true)
    expect(parsed.data.costPriceKurus).toBeNull()
    expect(parsed.data.leadTimeDays).toBeNull()
    expect(parsed.data.oemNumbers).toEqual([])
  })

  test("ad/kod/marka boş geçilemez", () => {
    expect(bakimxProductInputSchema.safeParse(productInput({ name: "  " })).success).toBe(false)
    expect(bakimxProductInputSchema.safeParse(productInput({ sku: "" })).success).toBe(false)
    expect(bakimxProductInputSchema.safeParse(productInput({ brandId: "" })).success).toBe(false)
  })

  test("fiyat kuruş (tam sayı) ve negatif olamaz", () => {
    expect(bakimxProductInputSchema.safeParse(productInput({ workshopPriceKurus: 1250.5 })).success).toBe(false)
    expect(bakimxProductInputSchema.safeParse(productInput({ workshopPriceKurus: -1 })).success).toBe(false)
  })

  test("KDV oranı bps olarak %100'ü geçemez", () => {
    expect(bakimxProductInputSchema.safeParse(productInput({ vatRateBps: 10001 })).success).toBe(false)
    expect(bakimxProductInputSchema.safeParse(productInput({ vatRateBps: 0 })).success).toBe(true)
  })

  test("görsel adresi boş ya da http(s) olmalı", () => {
    expect(bakimxProductInputSchema.safeParse(productInput({ imageUrl: "" })).success).toBe(true)
    expect(bakimxProductInputSchema.safeParse(productInput({ imageUrl: "https://cdn/x.png" })).success).toBe(true)
    expect(bakimxProductInputSchema.safeParse(productInput({ imageUrl: "javascript:alert(1)" })).success).toBe(false)
  })

  test("tedarik süresi 365 günle sınırlı", () => {
    expect(bakimxProductInputSchema.safeParse(productInput({ leadTimeDays: 366 })).success).toBe(false)
    expect(bakimxProductInputSchema.safeParse(productInput({ leadTimeDays: 30 })).success).toBe(true)
  })
})

describe("marka şeması", () => {
  test("ad zorunlu, logo opsiyonel", () => {
    expect(bakimxBrandInputSchema.safeParse({ name: "Mutlu" }).success).toBe(true)
    expect(bakimxBrandInputSchema.safeParse({ name: "" }).success).toBe(false)
    expect(bakimxBrandInputSchema.safeParse({ name: "Mutlu", logoUrl: "ftp://x" }).success).toBe(false)
  })
})

describe("toplu işlem şemaları", () => {
  const ids = ["p1", "p2"]

  test("seçim boş olamaz ve üst sınırı aşamaz", () => {
    expect(bakimxBulkActiveSchema.safeParse({ productIds: [], isActive: true }).success).toBe(false)
    const tooMany = Array.from({ length: BULK_SELECTION_LIMIT + 1 }, (_, i) => `p${i}`)
    expect(bakimxBulkActiveSchema.safeParse({ productIds: tooMany, isActive: true }).success).toBe(false)
  })

  test("yüzde sıfır olamaz, aralık dışına çıkamaz", () => {
    expect(bakimxBulkPriceSchema.safeParse({ productIds: ids, percent: 0 }).success).toBe(false)
    expect(bakimxBulkPriceSchema.safeParse({ productIds: ids, percent: -95 }).success).toBe(false)
    expect(bakimxBulkPriceSchema.safeParse({ productIds: ids, percent: 501 }).success).toBe(false)
    expect(bakimxBulkPriceSchema.safeParse({ productIds: ids, percent: -10 }).success).toBe(true)
  })

  test("stok kipi ve miktarı doğrulanır", () => {
    expect(bakimxBulkStockSchema.safeParse({ productIds: ids, mode: "set", quantity: 5 }).success).toBe(true)
    expect(bakimxBulkStockSchema.safeParse({ productIds: ids, mode: "reset", quantity: 5 }).success).toBe(false)
    expect(bakimxBulkStockSchema.safeParse({ productIds: ids, mode: "set", quantity: -1 }).success).toBe(false)
    expect(bakimxBulkStockSchema.safeParse({ productIds: ids, mode: "set", quantity: 1.5 }).success).toBe(false)
  })
})
