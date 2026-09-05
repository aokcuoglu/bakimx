import { expect, test } from "bun:test"
import { getPlanPriceMinor, formatMinor, isComplimentaryPlan } from "@/lib/billing/pricing"

test("getPlanPriceMinor returns VAT-included kuruş for monthly", () => {
  expect(getPlanPriceMinor("lite", "monthly")).toBe(0)
  expect(getPlanPriceMinor("pro", "monthly")).toBe(179900)
  expect(getPlanPriceMinor("premium", "monthly")).toBe(299900)
})

test("getPlanPriceMinor returns VAT-included kuruş for yearly", () => {
  expect(getPlanPriceMinor("lite", "yearly")).toBe(0)
  expect(getPlanPriceMinor("pro", "yearly")).toBe(1799000)
  expect(getPlanPriceMinor("premium", "yearly")).toBe(2999000)
})

test("formatMinor renders Turkish Lira", () => {
  expect(formatMinor(179900)).toContain("1.799")
})

test("yalnız ücretsiz Lite kampanyası ödeme toplamayı atlar", () => {
  expect(isComplimentaryPlan("lite", "monthly")).toBe(true)
  expect(isComplimentaryPlan("lite", "yearly")).toBe(true)
  expect(isComplimentaryPlan("pro", "monthly")).toBe(false)
  expect(isComplimentaryPlan("premium", "yearly")).toBe(false)
})
