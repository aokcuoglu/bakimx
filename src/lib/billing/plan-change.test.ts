import { expect, test } from "bun:test"
import { isDowngradeBlocked, isPlanDowngrade, isPlanUpgrade } from "@/lib/billing/plan-change"

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

test("aktif abonelikte düşürme engellenir (dönem sonu olmasa da)", () => {
  expect(
    isDowngradeBlocked({
      subscriptionStatus: "active",
      planTier: "premium",
      currentPeriodEnd: null,
      targetTier: "pro",
    }),
  ).toBe(true)
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
