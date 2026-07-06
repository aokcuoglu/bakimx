import { expect, test } from "bun:test"
import { deriveBillingOrderType } from "@/lib/billing/order-type"

const future = new Date("2027-01-01T00:00:00Z")

test("dönem hiç başlamadıysa ilk alım", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "trialing",
      planTier: "starter",
      currentPeriodEnd: null,
      targetTier: "pro",
    })
  ).toBe("new_purchase")
})

test("aktif + aynı paket → yenileme (aynı paket yeniden alınabilir)", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "pro",
      currentPeriodEnd: future,
      targetTier: "pro",
    })
  ).toBe("renewal")
})

test("aktif + farklı paket → yükseltme", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "pro",
      currentPeriodEnd: future,
      targetTier: "premium",
    })
  ).toBe("upgrade")
})

test("aktif değil ama dönem sonu var + aynı paket → yükseltme (yenileme değil)", () => {
  // Aktif olmayan (ör. past_due) aynı-paket talebi renewal değildir; yalnız
  // subscriptionStatus === "active" yenilemeyi tetikler.
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "past_due",
      planTier: "pro",
      currentPeriodEnd: future,
      targetTier: "pro",
    })
  ).toBe("upgrade")
})
