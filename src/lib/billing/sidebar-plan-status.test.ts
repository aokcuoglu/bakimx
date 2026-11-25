import { expect, test } from "bun:test"
import { TRIAL_ACCESS_TIER, getPlanState } from "@/lib/plan"
import { getSidebarPlanStatus } from "@/lib/billing/sidebar-plan-status"

test("deneme kalan iş gününü gösterir ve satıştan kalkan paket adını anmaz (#782)", () => {
  const plan = getPlanState({
    planTier: "pro", subscriptionStatus: "trialing", approvalStatus: "approved",
    trialEndsAt: new Date(Date.now() + 10 * 86_400_000), currentPeriodEnd: null,
  })
  expect(plan.accessTier).toBe(TRIAL_ACCESS_TIER)
  const status = getSidebarPlanStatus(plan, "Servis Paketi")
  expect(status.title).toMatch(/iş günü kaldı/)
  expect(status.detail).toBe("Ücretsiz deneme")
  expect(status.action).toBe("Paketi al")
  expect(JSON.stringify(status)).not.toContain("Premium")
})

test("active Lite and expiring paid subscriptions have distinct status", () => {
  const lite = getPlanState({
    planTier: "lite", subscriptionStatus: "active", approvalStatus: "approved",
    trialEndsAt: null, currentPeriodEnd: null, liteFreeGrantedAt: new Date(),
  })
  expect(getSidebarPlanStatus(lite, "Lite (eski)")).toMatchObject({ title: "Lite · ücretsiz", action: "İncele" })

  const pro = getPlanState({
    planTier: "pro", subscriptionStatus: "active", approvalStatus: "approved",
    trialEndsAt: null, currentPeriodEnd: new Date(Date.now() + 3 * 86_400_000),
  })
  expect(getSidebarPlanStatus(pro, "Servis Paketi")).toMatchObject({ title: "Servis Paketi", detail: "3 gün kaldı", action: "Yönet" })
})
