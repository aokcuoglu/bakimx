import { expect, test } from "bun:test"
import { applyDiscountMinor, getDiscountedPlanPriceMinor, getOrderReferralDiscountBps, getReferralDiscountBps } from "@/lib/billing/referral-discount"

const createdAt = new Date("2026-09-27T12:00:00Z")

test("referral offer applies from registration until, but not including, the first anniversary", () => {
  const referred = { referredByWorkshopId: "referrer", createdAt }
  expect(getReferralDiscountBps(referred, createdAt)).toBe(1000)
  expect(getReferralDiscountBps(referred, new Date("2027-09-27T11:59:59Z"))).toBe(1000)
  expect(getReferralDiscountBps(referred, new Date("2027-09-27T12:00:00Z"))).toBe(0)
  expect(getReferralDiscountBps({ referredByWorkshopId: null, createdAt }, createdAt)).toBe(0)
})

test("discount is applied to VAT-included paid prices and leaves Lite free", () => {
  expect(getDiscountedPlanPriceMinor("pro", "monthly", 1000)).toBe(161910)
  expect(getDiscountedPlanPriceMinor("premium", "yearly", 1000)).toBe(2699100)
  expect(getDiscountedPlanPriceMinor("lite", "monthly", 1000)).toBe(0)
  expect(applyDiscountMinor(101, 1000)).toBe(91)
})

test("only a recorded referral discount changes the credit base of a confirmed order", () => {
  expect(getOrderReferralDiscountBps({ referralDiscountBps: 1000 })).toBe(1000)
  expect(getOrderReferralDiscountBps({ referralDiscountBps: "1000" })).toBe(0)
  expect(getOrderReferralDiscountBps(null)).toBe(0)
})
