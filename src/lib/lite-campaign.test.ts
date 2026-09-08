import { afterEach, expect, test } from "bun:test"
import { assertLiteRegistrationOpen, hasLifetimeLite, isLiteRegistrationOpen } from "./lite-campaign"
import { getPlanState } from "./plan"
const saved = process.env.LITE_REGISTRATION_OPEN
afterEach(() => { if (saved === undefined) delete process.env.LITE_REGISTRATION_OPEN; else process.env.LITE_REGISTRATION_OPEN = saved })
const lite = { planTier: "lite" as const, liteFreeGrantedAt: new Date(), approvalStatus: "approved" as const, subscriptionStatus: "active" as const, trialEndsAt: null, currentPeriodEnd: null }
test("campaign is default open and malformed configured values fail closed", () => {
  delete process.env.LITE_REGISTRATION_OPEN
  expect(isLiteRegistrationOpen()).toBe(true)
  for (const value of ["false", "", "yes", "1"]) { process.env.LITE_REGISTRATION_OPEN = value; expect(() => assertLiteRegistrationOpen("lite")).toThrow(); expect(() => assertLiteRegistrationOpen("pro")).not.toThrow() }
})
test("closing admissions and stale billing status cannot expire permanent Lite", () => {
  process.env.LITE_REGISTRATION_OPEN = "false"
  for (const subscriptionStatus of ["active", "trialing", "past_due", "canceled"] as const) {
    const state = getPlanState({ ...lite, subscriptionStatus, trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) })
    expect(state).toMatchObject({ hasAccess: true, canWrite: true, isTrialing: false, accessTier: "lite", trialDaysLeft: null, subscriptionDaysLeft: null, currentPeriodEnd: null })
  }
})
test("free grant neither bypasses verification/suspension nor grants paid tier access", () => {
  for (const approvalStatus of ["pending", "rejected"] as const) expect(getPlanState({ ...lite, approvalStatus }).hasAccess).toBe(false)
  expect(hasLifetimeLite({ ...lite, planTier: "pro" })).toBe(false)
  expect(getPlanState({ ...lite, planTier: "pro", currentPeriodEnd: new Date(0) }).hasAccess).toBe(false)
  expect(getPlanState({ ...lite, liteFreeGrantedAt: null, currentPeriodEnd: new Date(0) }).hasAccess).toBe(false)
})
