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

test("half a monthly pro period remaining credits ~half of pro's price", () => {
  // 15 of 30 days left → credit = round(179900 * 0.5) = 89950; charge = 299900 - 89950
  const currentPeriodEnd = new Date(now.getTime() + 15 * 86_400_000)
  expect(
    computeUpgradeAmountMinor({
      currentTier: "pro",
      currentCycle: "monthly",
      currentPeriodEnd,
      newTier: "premium",
      newCycle: "monthly",
      now,
    })
  ).toBe(209950)
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
