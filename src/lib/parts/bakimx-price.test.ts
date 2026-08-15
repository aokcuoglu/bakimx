import { describe, it, expect } from "bun:test"
import { resolveWorkshopPrice, formatDiscountLabel, calculateDiscountAmount } from "./bakimx-price"

describe("bakimx-price", () => {
  describe("resolveWorkshopPrice", () => {
    it("returns base price when discount is 0", () => {
      expect(resolveWorkshopPrice(50000, 0)).toBe(50000)
      expect(resolveWorkshopPrice(10000, 0)).toBe(10000)
      expect(resolveWorkshopPrice(100000, 0)).toBe(100000)
    })

    it("applies %15 discount correctly", () => {
      // 50.00 ₺ with %15 discount = 50 × 0.85 = 42.50 ₺ = 4250 kuruş
      const basePrice = 5000 // 50.00 ₺
      const discount = 1500 // 15%
      const result = resolveWorkshopPrice(basePrice, discount)
      expect(result).toBe(4250)
    })

    it("applies %20 discount correctly", () => {
      // 100.00 ₺ with %20 discount = 100 × 0.80 = 80.00 ₺ = 8000 kuruş
      const basePrice = 10000 // 100.00 ₺
      const discount = 2000 // 20%
      const result = resolveWorkshopPrice(basePrice, discount)
      expect(result).toBe(8000)
    })

    it("applies %50 discount correctly", () => {
      // 100.00 ₺ with %50 discount = 100 × 0.50 = 50.00 ₺ = 5000 kuruş
      const basePrice = 10000 // 100.00 ₺
      const discount = 5000 // 50%
      const result = resolveWorkshopPrice(basePrice, discount)
      expect(result).toBe(5000)
    })

    it("applies %100 discount correctly", () => {
      // 100.00 ₺ with %100 discount = 100 × 0.00 = 0.00 ₺
      const basePrice = 10000 // 100.00 ₺
      const discount = 10000 // 100%
      const result = resolveWorkshopPrice(basePrice, discount)
      expect(result).toBe(0)
    })

    it("rounds down correctly for odd discounts", () => {
      // 33.00 ₺ with %33 discount = 33 × 0.67 = 22.11 ₺ = 2211 kuruş
      const basePrice = 3300 // 33.00 ₺
      const discount = 3300 // 33%
      const result = resolveWorkshopPrice(basePrice, discount)
      // 3300 × (10000 - 3300) / 10000 = 3300 × 6700 / 10000 = 2211
      expect(result).toBe(2211)
    })

    it("handles large prices", () => {
      // 10,000.00 ₺ with %15 discount
      const basePrice = 1000000 // 10,000.00 ₺
      const discount = 1500 // 15%
      const result = resolveWorkshopPrice(basePrice, discount)
      // 1000000 × 8500 / 10000 = 850000
      expect(result).toBe(850000)
    })

    it("handles small prices with small discounts", () => {
      // 0.50 ₺ (50 kuruş) with %10 discount
      const basePrice = 50
      const discount = 1000 // 10%
      const result = resolveWorkshopPrice(basePrice, discount)
      // 50 × 9000 / 10000 = 45
      expect(result).toBe(45)
    })
  })

  describe("formatDiscountLabel", () => {
    it("returns empty string for 0% discount", () => {
      expect(formatDiscountLabel(0)).toBe("")
    })

    it("formats %15 discount correctly", () => {
      expect(formatDiscountLabel(1500)).toBe("%15 BakımX iskontosu uygulandı")
    })

    it("formats %20 discount correctly", () => {
      expect(formatDiscountLabel(2000)).toBe("%20 BakımX iskontosu uygulandı")
    })

    it("formats %100 discount correctly", () => {
      expect(formatDiscountLabel(10000)).toBe("%100 BakımX iskontosu uygulandı")
    })

    it("formats decimal discount correctly", () => {
      // 0.5% = 50 bps
      expect(formatDiscountLabel(50)).toBe("%0.5 BakımX iskontosu uygulandı")
    })

    it("formats %1 discount correctly", () => {
      // 1% = 100 bps
      expect(formatDiscountLabel(100)).toBe("%1 BakımX iskontosu uygulandı")
    })
  })

  describe("calculateDiscountAmount", () => {
    it("returns 0 for 0% discount", () => {
      expect(calculateDiscountAmount(50000, 0)).toBe(0)
    })

    it("calculates discount amount for %15 discount", () => {
      // 50.00 ₺ with %15 discount = 7.50 ₺ = 750 kuruş discount
      const basePrice = 5000
      const discount = 1500 // 15%
      const result = calculateDiscountAmount(basePrice, discount)
      // 5000 × 1500 / 10000 = 750
      expect(result).toBe(750)
    })

    it("calculates discount amount for %20 discount", () => {
      // 100.00 ₺ with %20 discount = 20.00 ₺ = 2000 kuruş discount
      const basePrice = 10000
      const discount = 2000 // 20%
      const result = calculateDiscountAmount(basePrice, discount)
      // 10000 × 2000 / 10000 = 2000
      expect(result).toBe(2000)
    })

    it("calculates discount amount for %50 discount", () => {
      // 100.00 ₺ with %50 discount = 50.00 ₺ = 5000 kuruş discount
      const basePrice = 10000
      const discount = 5000 // 50%
      const result = calculateDiscountAmount(basePrice, discount)
      // 10000 × 5000 / 10000 = 5000
      expect(result).toBe(5000)
    })

    it("calculates discount amount for %100 discount", () => {
      const basePrice = 10000
      const discount = 10000 // 100%
      const result = calculateDiscountAmount(basePrice, discount)
      expect(result).toBe(10000)
    })

    it("rounds down discount amount correctly", () => {
      // 100.00 ₺ with %33 discount = 33.00 ₺ discount (rounded)
      const basePrice = 10000
      const discount = 3300 // 33%
      const result = calculateDiscountAmount(basePrice, discount)
      // 10000 × 3300 / 10000 = 3300
      expect(result).toBe(3300)
    })
  })

  describe("integration: price consistency", () => {
    it("verifies: basePrice - discountAmount = discountedPrice", () => {
      const basePrice = 5000 // 50.00 ₺
      const discount = 1500 // 15%
      const discounted = resolveWorkshopPrice(basePrice, discount)
      const discountAmount = calculateDiscountAmount(basePrice, discount)
      const calculated = basePrice - discountAmount

      expect(discounted).toBe(calculated)
      expect(discounted).toBe(4250)
      expect(discountAmount).toBe(750)
    })

    it("verifies large price consistency", () => {
      const basePrice = 1000000 // 10,000.00 ₺
      const discount = 2000 // 20%
      const discounted = resolveWorkshopPrice(basePrice, discount)
      const discountAmount = calculateDiscountAmount(basePrice, discount)

      expect(discounted + discountAmount).toBe(basePrice)
      expect(discounted).toBe(800000)
      expect(discountAmount).toBe(200000)
    })
  })
})
