import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const read = (path: string) => readFileSync(join(root, path), "utf8")

test("paket aktivasyonu ek özellik siparişini ayrı yola devreder (#829)", () => {
  const src = read("src/lib/billing/activate.ts")
  expect(src).toContain('order.type === "addon"')
  expect(src).toContain("activateAddonOrder(order, opts)")
})

test("ek özellik siparişi sunucu fiyatı, hesap ve bekleyen-sipariş kapılarını taşır (#829)", () => {
  const src = read("src/app/(app)/billing/addon-actions.ts")
  expect(src).toContain('requireWritableWorkshop("billing.manage")')
  expect(src).toContain("priceAddonOrder(")
  expect(src).toContain("resolveBillingAccount(")
  expect(src).toContain("isAccountWorkshop")
  expect(src).toContain('status: "pending_payment"')
  expect(src).toContain("purchasable")
  expect(src).toContain("billing_addon_order_created")
})

test("paketin önceki siparişi ek özellik siparişlerini saymaz (#829)", () => {
  expect(read("src/app/(app)/billing/actions.ts")).toContain('type: { not: "addon" }')
})
