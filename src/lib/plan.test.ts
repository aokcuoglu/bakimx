import { expect, test } from "bun:test"
import { hasFeature, getPlanState, assertWriteAccess, PlanWriteLockedError } from "@/lib/plan"

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

// --- canWrite matrix: read-only lock on plan expiry -------------------------

test("canWrite is true for an active in-period subscription", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  expect(getPlanState(wsFields({ currentPeriodEnd: future })).canWrite).toBe(true)
})

test("canWrite is true for an active trial", () => {
  const future = new Date(Date.now() + 3 * 86_400_000)
  const s = getPlanState(wsFields({ subscriptionStatus: "trialing", trialEndsAt: future }))
  expect(s.canWrite).toBe(true)
})

test("canWrite is false when the trial has expired", () => {
  const past = new Date(Date.now() - 86_400_000)
  const s = getPlanState(wsFields({ subscriptionStatus: "trialing", trialEndsAt: past }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("trial_expired")
  expect(s.canWrite).toBe(false)
})

test("canWrite is false when an active subscription is past its period end", () => {
  const past = new Date(Date.now() - 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: past }))
  expect(s.lockReason).toBe("subscription_expired")
  expect(s.canWrite).toBe(false)
})

test("canWrite is false when the subscription is past_due (inactive)", () => {
  const s = getPlanState(wsFields({ subscriptionStatus: "past_due" }))
  expect(s.lockReason).toBe("subscription_inactive")
  expect(s.canWrite).toBe(false)
})

// pending/rejected are full-screen locked elsewhere; canWrite stays true there
// deliberately (see plan.ts) so it never becomes a second confusing gate.
test("canWrite is true for a pending workshop (full-lock handled separately)", () => {
  const s = getPlanState(wsFields({ approvalStatus: "pending", subscriptionStatus: "trialing" }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("pending")
  expect(s.canWrite).toBe(true)
})

// --- assertWriteAccess ------------------------------------------------------

test("assertWriteAccess is a no-op when the workshop may write", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  expect(() => assertWriteAccess(wsFields({ currentPeriodEnd: future }))).not.toThrow()
})

test("assertWriteAccess throws PlanWriteLockedError with the trial message", () => {
  const past = new Date(Date.now() - 86_400_000)
  try {
    assertWriteAccess(wsFields({ subscriptionStatus: "trialing", trialEndsAt: past }))
    throw new Error("expected throw")
  } catch (e) {
    expect(e).toBeInstanceOf(PlanWriteLockedError)
    expect((e as PlanWriteLockedError).lockReason).toBe("trial_expired")
    expect((e as Error).message).toBe("Deneme süreniz doldu. Devam etmek için bir paket satın alın.")
  }
})

test("assertWriteAccess throws the subscription message for an expired subscription", () => {
  const past = new Date(Date.now() - 86_400_000)
  try {
    assertWriteAccess(wsFields({ currentPeriodEnd: past }))
    throw new Error("expected throw")
  } catch (e) {
    expect(e).toBeInstanceOf(PlanWriteLockedError)
    expect((e as Error).message).toBe("Aboneliğiniz sona erdi. Devam etmek için aboneliğinizi yenileyin.")
  }
})
