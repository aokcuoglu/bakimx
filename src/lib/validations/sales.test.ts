import { describe, expect, it } from "bun:test"
import { salesDiscountCodeSchema, salesDiscountCodeUpdateSchema } from "./sales"

describe("sales discount code update validation", () => {
  it("accepts a date input value", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "2026-09-02" }).success).toBe(true)
  })

  it("rejects malformed dates", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "02/09/2026" }).success).toBe(false)
  })
})

describe("sales discount code creation validation", () => {
  it("accepts the two explicit funding sources", () => {
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 12,
      advisorId: "advisor-1",
      fundingSource: "bakimx_funded",
    }).success).toBe(true)
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 8,
      fundingSource: "advisor_margin",
    }).success).toBe(true)
  })

  it("rejects an unknown funding source", () => {
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 10,
      fundingSource: "campaign",
    }).success).toBe(false)
  })
})
