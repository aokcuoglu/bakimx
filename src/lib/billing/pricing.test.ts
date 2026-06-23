import { expect, test } from "bun:test"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"

test("getPlanPriceMinor returns VAT-included kuruş for monthly", () => {
  expect(getPlanPriceMinor("starter", "monthly")).toBe(74900)
  expect(getPlanPriceMinor("pro", "monthly")).toBe(129900)
  expect(getPlanPriceMinor("premium", "monthly")).toBe(219900)
})

test("getPlanPriceMinor returns VAT-included kuruş for yearly", () => {
  expect(getPlanPriceMinor("pro", "yearly")).toBe(1299000)
  expect(getPlanPriceMinor("premium", "yearly")).toBe(2199000)
})

test("formatMinor renders Turkish Lira", () => {
  expect(formatMinor(129900)).toContain("1.299")
})
