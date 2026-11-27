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
  expect(src).toContain("evaluateAddonOrderEligibility(")
  expect(src).toContain('status: "pending_payment"')
  expect(src).toContain("billing_addon_order_created")
})

test("paketin önceki siparişi ek özellik siparişlerini saymaz (#829)", () => {
  expect(read("src/app/(app)/billing/actions.ts")).toContain('type: { not: "addon" }')
})

test("TAMI initiate ek özellikte dönemi FOR UPDATE işlemi içinde yeniden denetler (#829)", () => {
  const src = read("src/app/api/payments/tami/initiate/route.ts")
  const lock = src.indexOf("FOR UPDATE")
  const check = src.indexOf("isAddonPeriodOpen(")
  const create = src.indexOf("tx.paymentTransaction.create")
  expect(lock).toBeGreaterThan(-1)
  expect(check).toBeGreaterThan(lock)
  expect(create).toBeGreaterThan(check)
  expect(src).toContain('order.type === "addon"')
})

test("bekleyen sipariş guard'ları dönemi bitmiş ek özellik siparişini önce serbest bırakır (#829)", () => {
  for (const path of ["src/app/(app)/billing/actions.ts", "src/app/(app)/billing/addon-actions.ts"]) {
    const src = read(path)
    const release = src.indexOf("releaseExpiredAddonOrders(pendingScope")
    expect(release).toBeGreaterThan(-1)
    expect(src.indexOf('status: "pending_payment", ...pendingScope')).toBeGreaterThan(release)
  }
  expect(read("src/lib/billing/lifecycle.ts")).toContain("releaseExpiredAddonOrders(")
  expect(read("src/app/checkout/page.tsx")).toContain("isReleasableExpiredAddonOrder(")
})
