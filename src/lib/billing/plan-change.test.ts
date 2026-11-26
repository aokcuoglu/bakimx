import { expect, test } from "bun:test"
import { DOWNGRADE_BLOCKED_MESSAGE, isDowngradeBlocked, isPlanDowngrade, isPlanUpgrade } from "@/lib/billing/plan-change"

test("premium → pro/lite düşürmedir", () => {
  expect(isPlanDowngrade("premium", "pro")).toBe(true)
  expect(isPlanDowngrade("premium", "lite")).toBe(true)
  expect(isPlanDowngrade("pro", "lite")).toBe(true)
})

test("aynı paket veya yükseltme düşürme değildir", () => {
  expect(isPlanDowngrade("premium", "premium")).toBe(false)
  expect(isPlanDowngrade("pro", "premium")).toBe(false)
  expect(isPlanDowngrade("lite", "pro")).toBe(false)
  expect(isPlanDowngrade(null, "lite")).toBe(false)
})

test("dönemi süren premium hâlâ engelli", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: new Date("2026-12-24T00:00:00Z"),
      targetTier: "pro",
      now: new Date("2026-11-24T00:00:00Z"),
    }),
  ).toBe(true)
})

// #782: satışta yalnız Servis Paketi var. Durum `active` kalsa bile dönemi bitmiş
// (ya da hiç dönemi olmayan, elle verilmiş) premium satırı kilitli kalmamalı.
test("süresi dolmuş premium Servis Paketi'ni satın alabilir", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
      targetTier: "pro",
      now: new Date("2026-11-24T00:00:00Z"),
    }),
  ).toBe(false)
})

test("dönemsiz (elle verilmiş) aktif premium Servis Paketi'ni satın alabilir", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: null,
      targetTier: "pro",
    }),
  ).toBe(false)
})

test("açık dönemde past_due olsa bile düşürme engellenir", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "past_due",
      planTier: "premium",
      currentPeriodEnd: new Date("2030-01-01T00:00:00Z"),
      targetTier: "lite",
      now: new Date("2026-09-25T00:00:00Z"),
    }),
  ).toBe(true)
})

test("süresi bitmiş veya deneme (aktif değil) iken düşürme serbest", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "expired",
      planTier: "premium",
      currentPeriodEnd: new Date("2020-01-01T00:00:00Z"),
      targetTier: "pro",
      now: new Date("2026-09-25T00:00:00Z"),
    }),
  ).toBe(false)
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "trialing",
      planTier: "lite",
      currentPeriodEnd: null,
      targetTier: "lite",
    }),
  ).toBe(false)
})

test("yükseltme hiçbir zaman engellenmez", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "active",
      planTier: "pro",
      currentPeriodEnd: new Date("2030-01-01T00:00:00Z"),
      targetTier: "premium",
    }),
  ).toBe(false)
})

test("isPlanUpgrade üst paketi tanır", () => {
  expect(isPlanUpgrade("lite", "pro")).toBe(true)
  expect(isPlanUpgrade("premium", "pro")).toBe(false)
})

test("eski satırdan Servis Paketi'ne geçiş yükseltmedir; Paket + ek özelliklerden düşüştür", () => {
  expect(isPlanUpgrade("lite", "pro")).toBe(true)
  expect(isPlanUpgrade("starter", "pro")).toBe(true)
  expect(isPlanDowngrade("premium", "pro")).toBe(true)
})

// #830: tek pakette "daha düşük paket" dili yanlış; engel dönemi süren eski
// satırdan Servis Paketi'ne geçişte çıkar.
test("engel metni tek paket dilinde: Servis Paketi'ni anar, alt paketten söz etmez", () => {
  expect(DOWNGRADE_BLOCKED_MESSAGE).not.toContain("daha düşük paket")
  expect(DOWNGRADE_BLOCKED_MESSAGE).toContain("Servis Paketi")
  expect(DOWNGRADE_BLOCKED_MESSAGE).toContain("iade")
})
