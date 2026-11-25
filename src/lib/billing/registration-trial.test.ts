import { expect, test } from "bun:test"
import { computeTrialEnd, getPlanState, isSalePlanTier } from "@/lib/plan"
import {
  REGISTRATION_TRIAL_TIER,
  pendingRegistrationPlanData,
  verifiedRegistrationTrialData,
} from "@/lib/billing/registration-trial"

const now = new Date("2026-11-24T09:00:00.000Z")

test("doğrulama 7 iş günlük Servis Paketi denemesi başlatır — ücretsiz hak bırakmaz (#782)", () => {
  const data = verifiedRegistrationTrialData(now)
  expect(isSalePlanTier(REGISTRATION_TRIAL_TIER)).toBe(true)
  expect(data).toEqual({
    planTier: "pro",
    subscriptionStatus: "trialing",
    liteFreeGrantedAt: null,
    approvalStatus: "approved",
    trialStartedAt: now,
    trialEndsAt: computeTrialEnd(now),
  })
})

test("yarım kalan eski Lite kaydı doğrulanınca süresiz Lite değil, deneme olur", () => {
  const pendingLite = {
    planTier: "lite" as const,
    subscriptionStatus: "active" as const,
    approvalStatus: "pending" as const,
    liteFreeGrantedAt: new Date("2026-10-01T00:00:00.000Z"),
    trialEndsAt: null,
    currentPeriodEnd: null,
  }
  const verified = { ...pendingLite, ...verifiedRegistrationTrialData(new Date()) }
  const state = getPlanState(verified)
  expect(state.tier).toBe("pro")
  expect(state.isTrialing).toBe(true)
  expect(state.trialEndsAt).not.toBeNull()
  expect(verified.liteFreeGrantedAt).toBeNull()
})

test("yeniden gönderim eski tier'ı Servis Paketi denemesine çeker, denemeyi başlatmaz", () => {
  expect(pendingRegistrationPlanData()).toEqual({ planTier: "pro", subscriptionStatus: "trialing", liteFreeGrantedAt: null })
  expect(pendingRegistrationPlanData()).not.toHaveProperty("trialStartedAt")
  expect(pendingRegistrationPlanData()).not.toHaveProperty("approvalStatus")
})
