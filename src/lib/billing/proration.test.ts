import { expect, test } from "bun:test"
import { computeUpgradeAmountMinor } from "@/lib/billing/proration"

const now = new Date("2026-06-01T00:00:00Z")

test("no current period → full new price (no credit)", () => {
  expect(
    computeUpgradeAmountMinor({
      currentTier: "pro",
      currentCycle: "monthly",
      currentPeriodEnd: null,
      newTier: "premium",
      newCycle: "monthly",
      now,
    })
  ).toBe(299900)
})

test("expired current period → full new price (no credit)", () => {
  expect(
    computeUpgradeAmountMinor({
      currentTier: "pro",
      currentCycle: "monthly",
      currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
      newTier: "premium",
      newCycle: "monthly",
      now,
    })
  ).toBe(299900)
})

test("half a monthly legacy starter period remaining credits ~half of its price toward Servis Paketi", () => {
  // 15 of 30 days left → credit = round(74900 * 0.5) = 37450; charge = 149900 - 37450
  const currentPeriodEnd = new Date(now.getTime() + 15 * 86_400_000)
  expect(
    computeUpgradeAmountMinor({
      currentTier: "starter",
      currentCycle: "monthly",
      currentPeriodEnd,
      newTier: "pro",
      newCycle: "monthly",
      now,
    })
  ).toBe(112450)
})

test("credit is capped at one cycle and the charge is floored at 0", () => {
  // 999 days "left" (e.g. from prior stacking) on premium → fraction capped at 1,
  // credit = full premium price; charging legacy starter → max(0, 74900 - 299900) = 0
  const currentPeriodEnd = new Date(now.getTime() + 999 * 86_400_000)
  expect(
    computeUpgradeAmountMinor({
      currentTier: "premium",
      currentCycle: "monthly",
      currentPeriodEnd,
      newTier: "starter",
      newCycle: "monthly",
      now,
    })
  ).toBe(0)
})

test("an upgrade credits the price actually paid when the prior order was discounted", () => {
  const currentPeriodEnd = new Date(now.getTime() + 15 * 86_400_000)
  expect(computeUpgradeAmountMinor({
    currentTier: "pro", currentCycle: "monthly", currentPeriodEnd,
    newTier: "premium", newCycle: "monthly", now,
    currentPriceMinor: 161910, newPriceMinor: 269910,
  })).toBe(188955)
})
