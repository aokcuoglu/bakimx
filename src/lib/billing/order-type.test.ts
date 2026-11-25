import { expect, test } from "bun:test"
import { deriveBillingOrderType } from "@/lib/billing/order-type"

// Sabit "şimdi": dönem sonu karşılaştırması (#782) takvim ilerledikçe testleri bozmasın.
const now = new Date("2026-11-24T00:00:00Z")
const future = new Date("2027-01-01T00:00:00Z")
const past = new Date("2026-10-01T00:00:00Z")

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
      now,
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
      now,
      targetTier: "premium",
    })
  ).toBe("upgrade")
})

test("aktif değil ama dönem sonu var + aynı paket → yenileme", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "past_due",
      planTier: "pro",
      currentPeriodEnd: future,
      now,
      targetTier: "pro",
    })
  ).toBe("renewal")
})

test("lite paketinden yükseltme → upgrade", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "lite",
      currentPeriodEnd: future,
      now,
      targetTier: "starter",
    })
  ).toBe("upgrade")
})

test("lite paketinde ilk alım → new_purchase", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "trialing",
      planTier: "lite",
      currentPeriodEnd: null,
      targetTier: "lite",
    })
  ).toBe("new_purchase")
})

test("daha alt pakete geçiş → downgrade", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: future,
      now,
      targetTier: "starter",
    })
  ).toBe("downgrade")
})

test("dönemi bitmiş premium Servis Paketi'ne geçerse ilk alım — kredi yok, dönem bugünden (#782)", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: past,
      targetTier: "pro",
      now,
    })
  ).toBe("new_purchase")
})

test("dönemi bitmiş aynı paket yenilemedir", () => {
  expect(
    deriveBillingOrderType({
      subscriptionStatus: "active",
      planTier: "pro",
      currentPeriodEnd: past,
      targetTier: "pro",
      now,
    })
  ).toBe("renewal")
})
