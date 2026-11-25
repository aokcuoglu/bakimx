import { expect, test } from "bun:test"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import * as pricing from "@/lib/billing/pricing"

test("Servis Paketi tutarı KDV dahil kuruş olarak katalogdan gelir", () => {
  expect(getPlanPriceMinor("pro", "monthly")).toBe(149900)
  expect(getPlanPriceMinor("pro", "yearly")).toBe(1499000)
})

test("eski paket satırları proration ve makbuz için hâlâ fiyatlanır", () => {
  expect(getPlanPriceMinor("lite", "monthly")).toBe(0)
  expect(getPlanPriceMinor("starter", "monthly")).toBe(74900)
  expect(getPlanPriceMinor("premium", "monthly")).toBe(299900)
  expect(getPlanPriceMinor("premium", "yearly")).toBe(2999000)
})

test("formatMinor renders Turkish Lira", () => {
  expect(formatMinor(149900)).toContain("1.499")
})

test("ücretsiz paket yok — ödeme toplamayı atlayan yol kaldırıldı (#782)", () => {
  expect("isComplimentaryPlan" in pricing).toBe(false)
})
