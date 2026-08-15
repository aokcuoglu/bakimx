import { describe, it, expect } from "bun:test"
import {
  bakimxDiscountFormSchema,
  bakimxDiscountInputSchema,
  percentToBps,
  bpsToPercent,
} from "./bakimx-discount"

describe("BakımX discount validation (BAK-47)", () => {
  describe("bakimxDiscountFormSchema", () => {
    it("accepts 0% discount", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "0" })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.discountPercent).toBe(0)
    })

    it("accepts 100% discount", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "100" })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.discountPercent).toBe(100)
    })

    it("accepts decimal percentages", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "15.5" })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.discountPercent).toBe(15.5)
    })

    it("accepts empty string as 0%", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "" })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.discountPercent).toBe(0)
    })

    it("rejects negative percentages", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "-5" })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("%0 ile %100")
      }
    })

    it("rejects percentages > 100", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "150" })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("%0 ile %100")
      }
    })

    it("rejects non-numeric values", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "abc" })
      expect(result.success).toBe(false)
    })

    it("trims whitespace", () => {
      const result = bakimxDiscountFormSchema.safeParse({ discountPercent: "  25  " })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.discountPercent).toBe(25)
    })
  })

  describe("bakimxDiscountInputSchema", () => {
    it("accepts 0 bps (0% discount)", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: 0 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.bakimxDiscountBps).toBe(0)
    })

    it("accepts 10000 bps (100% discount)", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: 10000 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.bakimxDiscountBps).toBe(10000)
    })

    it("accepts 2000 bps (20% discount)", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: 2000 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.bakimxDiscountBps).toBe(2000)
    })

    it("rejects negative bps", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: -100 })
      expect(result.success).toBe(false)
    })

    it("rejects bps > 10000", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: 15000 })
      expect(result.success).toBe(false)
    })

    it("rejects non-integer bps", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: 1500.5 })
      expect(result.success).toBe(false)
    })

    it("coerces string to number", () => {
      const result = bakimxDiscountInputSchema.safeParse({ bakimxDiscountBps: "2000" })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.bakimxDiscountBps).toBe(2000)
    })
  })

  describe("percentToBps", () => {
    it("converts 0% to 0 bps", () => {
      expect(percentToBps(0)).toBe(0)
    })

    it("converts 1% to 100 bps", () => {
      expect(percentToBps(1)).toBe(100)
    })

    it("converts 15% to 1500 bps", () => {
      expect(percentToBps(15)).toBe(1500)
    })

    it("converts 20% to 2000 bps", () => {
      expect(percentToBps(20)).toBe(2000)
    })

    it("converts 100% to 10000 bps", () => {
      expect(percentToBps(100)).toBe(10000)
    })

    it("converts decimal percentages", () => {
      expect(percentToBps(15.5)).toBe(1550)
      expect(percentToBps(0.5)).toBe(50)
    })
  })

  describe("bpsToPercent", () => {
    it("converts 0 bps to 0%", () => {
      expect(bpsToPercent(0)).toBe(0)
    })

    it("converts 100 bps to 1%", () => {
      expect(bpsToPercent(100)).toBe(1)
    })

    it("converts 1500 bps to 15%", () => {
      expect(bpsToPercent(1500)).toBe(15)
    })

    it("converts 2000 bps to 20%", () => {
      expect(bpsToPercent(2000)).toBe(20)
    })

    it("converts 10000 bps to 100%", () => {
      expect(bpsToPercent(10000)).toBe(100)
    })

    it("converts decimal bps", () => {
      expect(bpsToPercent(1550)).toBe(15.5)
      expect(bpsToPercent(50)).toBe(0.5)
    })
  })

  describe("round-trip conversion", () => {
    it("percent → bps → percent preserves value", () => {
      const testCases = [0, 1, 15.5, 20, 50, 100]
      testCases.forEach((percent) => {
        const bps = percentToBps(percent)
        const recovered = bpsToPercent(bps)
        expect(recovered).toBe(percent)
      })
    })

    it("bps → percent → bps preserves value", () => {
      const testCases = [0, 100, 1500, 1550, 2000, 5000, 10000]
      testCases.forEach((bps) => {
        const percent = bpsToPercent(bps)
        const recovered = percentToBps(percent)
        expect(recovered).toBe(bps)
      })
    })
  })
})
