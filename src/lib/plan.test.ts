import { expect, test } from "bun:test"
import {
  hasFeature,
  getPlanState,
  assertWriteAccess,
  isPlanExpiredLock,
  PlanWriteLockedError,
  PLAN_EXPIRED_LOCK_REASONS,
  PLAN_SEATS,
  getSeatLimit,
  seatLimitMessage,
} from "@/lib/plan"

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

test("marketResearch is gated to the premium tier", () => {
  expect(hasFeature("premium", "marketResearch")).toBe(true)
  expect(hasFeature("pro", "marketResearch")).toBe(false)
  expect(hasFeature("starter", "marketResearch")).toBe(false)
})

// VIN'den araç tanıma (rapidapi) is a Pro+ capability: billed external lookups,
// so starter is locked out while trial (pro) and premium keep access.
test("vinLookup is gated to the pro tier and above", () => {
  expect(hasFeature("starter", "vinLookup")).toBe(false)
  expect(hasFeature("pro", "vinLookup")).toBe(true)
  expect(hasFeature("premium", "vinLookup")).toBe(true)
})

test("all premium-gated features are locked below the premium tier", () => {
  const premiumOnly = ["eInvoice", "aiAdvisor", "multiBranch", "rbac", "marketResearch"] as const
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

// pending/rejected MUST also block writes: the full-screen PlanLocked view is
// only HTML — a pending session can call server actions / API routes directly
// with its cookie, so canWrite (server-side enforcement) is the real gate.
test("canWrite is false for a pending workshop (card not verified — server-side gate)", () => {
  const s = getPlanState(wsFields({ approvalStatus: "pending", subscriptionStatus: "trialing" }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("pending")
  expect(s.canWrite).toBe(false)
})

test("canWrite is false for a rejected workshop (suspended)", () => {
  const s = getPlanState(wsFields({ approvalStatus: "rejected", subscriptionStatus: "trialing" }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("rejected")
  expect(s.canWrite).toBe(false)
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

test("assertWriteAccess throws the card-verification message for a pending workshop", () => {
  try {
    assertWriteAccess(wsFields({ approvalStatus: "pending", subscriptionStatus: "trialing" }))
    throw new Error("expected throw")
  } catch (e) {
    expect(e).toBeInstanceOf(PlanWriteLockedError)
    expect((e as PlanWriteLockedError).lockReason).toBe("pending")
    expect((e as Error).message).toBe(
      "Hesabınız kart doğrulaması bekliyor. Devam etmek için kartınızı doğrulayın."
    )
  }
})

test("assertWriteAccess throws the suspended message for a rejected workshop", () => {
  try {
    assertWriteAccess(wsFields({ approvalStatus: "rejected", subscriptionStatus: "trialing" }))
    throw new Error("expected throw")
  } catch (e) {
    expect(e).toBeInstanceOf(PlanWriteLockedError)
    expect((e as PlanWriteLockedError).lockReason).toBe("rejected")
    expect((e as Error).message).toBe("Hesabınız askıya alınmış. Destek ile iletişime geçin.")
  }
})

test("isPlanExpiredLock covers every pay-to-continue lock reason", () => {
  const trial = getPlanState(
    wsFields({ subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() - 1000) })
  )
  const subExpired = getPlanState(wsFields({ currentPeriodEnd: new Date(Date.now() - 1000) }))
  const inactive = getPlanState(wsFields({ subscriptionStatus: "past_due" }))

  expect(isPlanExpiredLock(trial.lockReason)).toBe(true)
  expect(isPlanExpiredLock(subExpired.lockReason)).toBe(true)
  expect(isPlanExpiredLock(inactive.lockReason)).toBe(true)
  expect(PLAN_EXPIRED_LOCK_REASONS.length).toBe(3)
})

test("isPlanExpiredLock excludes the approval gate and unlocked plans", () => {
  const pending = getPlanState(wsFields({ approvalStatus: "pending", subscriptionStatus: "trialing" }))
  const rejected = getPlanState(wsFields({ approvalStatus: "rejected" }))

  expect(isPlanExpiredLock(pending.lockReason)).toBe(false)
  expect(isPlanExpiredLock(rejected.lockReason)).toBe(false)
  expect(isPlanExpiredLock(getPlanState(wsFields()).lockReason)).toBe(false)
  expect(isPlanExpiredLock(null)).toBe(false)
  expect(isPlanExpiredLock("1")).toBe(false)
})

test("starter paketi tek koltuk taşır — alt kullanıcı açılamaz", () => {
  // BAK-37'nin en kritik UX noktası: starter'daki atölyede sahibin kendisi tek
  // koltuğu doldurur, yani hiç usta/çırak ekleyemez.
  expect(PLAN_SEATS.starter).toBe(1)
  expect(getSeatLimit("starter")).toBe(1)
  expect(getSeatLimit("starter", 2)).toBe(3)
})

test("koltuk limiti mesajı sayıları ve yükseltme çıkışını söyler", () => {
  const message = seatLimitMessage("pro", 5, 5)
  expect(message).toContain("(5/5)")
  expect(message).toContain("yükseltin")
  // Sessiz bir "işlem başarısız" kabul edilemez — metin ne yapılacağını söylemeli.
  expect(message).not.toBe("İşlem başarısız")
})

test("tek koltuklu pakette mesaj nedeni açıkça anlatır", () => {
  const message = seatLimitMessage("starter", 1, 1)
  expect(message).toContain("(1/1)")
  expect(message).toContain("Başlangıç")
  expect(message).toContain("tek kullanıcı")
  expect(message).toContain("yükseltmeniz")
})
