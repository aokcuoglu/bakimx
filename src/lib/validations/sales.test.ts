import { describe, expect, it } from "bun:test"
import { salesDiscountCodeUpdateSchema } from "./sales"

describe("sales discount code update validation", () => {
  it("accepts a date input value", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "2026-09-02" }).success).toBe(true)
  })

  it("rejects malformed dates", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "02/09/2026" }).success).toBe(false)
  })
})
