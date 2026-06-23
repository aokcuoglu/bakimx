import { expect, test } from "bun:test"
import { hasFeature, getPlanState } from "@/lib/plan"

function wsFields(over: Partial<Parameters<typeof getPlanState>[0]> = {}) {
  return {
    planTier: "pro" as const,
    subscriptionStatus: "active" as const,
    approvalStatus: "approved" as const,
    trialEndsAt: null,
    currentPeriodEnd: null,
    ...over,
  }
}

test("active subscription past currentPeriodEnd locks as subscription_expired", () => {
  const past = new Date(Date.now() - 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: past }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("subscription_expired")
})

test("active subscription within period has access and reports days left", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: future }))
  expect(s.hasAccess).toBe(true)
  expect(s.subscriptionDaysLeft).toBe(5)
})

test("active subscription with null period keeps access (legacy/admin-provisioned)", () => {
  const s = getPlanState(wsFields({ currentPeriodEnd: null }))
  expect(s.hasAccess).toBe(true)
  expect(s.lockReason).toBe(null)
  expect(s.subscriptionDaysLeft).toBe(null)
})

// AI Servis Danışmanı is a Premium-only capability. Trial workshops run on the
// `pro` tier, so the advisor stays locked until they upgrade.
test("aiAdvisor is gated to the premium tier", () => {
  expect(hasFeature("premium", "aiAdvisor")).toBe(true)
  expect(hasFeature("pro", "aiAdvisor")).toBe(false)
  expect(hasFeature("starter", "aiAdvisor")).toBe(false)
})

test("all premium-gated features are locked below the premium tier", () => {
  const premiumOnly = ["eInvoice", "aiAdvisor", "multiBranch", "rbac"] as const
  for (const feature of premiumOnly) {
    expect(hasFeature("starter", feature)).toBe(false)
    expect(hasFeature("pro", feature)).toBe(false)
    expect(hasFeature("premium", feature)).toBe(true)
  }
})
