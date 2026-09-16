import { expect, test } from "bun:test"
import { getPlanState } from "@/lib/plan"
import { getSidebarPlanStatus } from "@/lib/billing/sidebar-plan-status"

test("Lite trial shows remaining business days and Premium access without calling Lite the active entitlement", () => {
  const plan = getPlanState({
    planTier: "lite", subscriptionStatus: "trialing", approvalStatus: "approved",
    trialEndsAt: new Date(Date.now() + 10 * 86_400_000), currentPeriodEnd: null,
  })
  expect(plan.accessTier).toBe("premium")
  const status = getSidebarPlanStatus(plan, "Lite")
  expect(status.title).toMatch(/iş günü kaldı/)
  expect(status.detail).toBe("Premium denemesi")
  expect(status.action).toBe("Paket seç")
})

test("active Lite and expiring paid subscriptions have distinct status", () => {
  const lite = getPlanState({
    planTier: "lite", subscriptionStatus: "active", approvalStatus: "approved",
    trialEndsAt: null, currentPeriodEnd: null, liteFreeGrantedAt: new Date(),
  })
  expect(getSidebarPlanStatus(lite, "Lite")).toMatchObject({ title: "Lite · ücretsiz", action: "İncele" })

  const pro = getPlanState({
    planTier: "pro", subscriptionStatus: "active", approvalStatus: "approved",
    trialEndsAt: null, currentPeriodEnd: new Date(Date.now() + 3 * 86_400_000),
  })
  expect(getSidebarPlanStatus(pro, "Profesyonel")).toMatchObject({ title: "Profesyonel", detail: "3 gün kaldı", action: "Yönet" })
})
