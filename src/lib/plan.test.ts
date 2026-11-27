import { expect, test } from "bun:test"
import { ADDON_CATALOG } from "@/lib/plans-catalog"
import {
  hasFeature,
  hasWorkshopFeature,
  getPlanState,
  getEffectiveSeatLimit,
  assertWriteAccess,
  isPlanExpiredLock,
  PlanWriteLockedError,
  PLAN_EXPIRED_LOCK_REASONS,
  PLAN_SEATS,
  TRIAL_SEAT_LIMIT,
  TRIAL_ACCESS_TIER,
  getSeatLimit,
  seatLimitMessage,
  VIN_LOOKUP_QUOTA,
  PLAN_LABELS,
  PLAN_TIERS,
  isPlanTier,
  businessDaysUntil,
  computeTrialEnd,
  GATED_FEATURES,
  assertFeature,
  PlanFeatureLockedError,
  ADDON_FEATURES,
  ADDON_CONTACT_LOCKED_MESSAGE,
  ADDON_LOCKED_MESSAGE,
  CONTACT_ONLY_ADDON_FEATURES,
  SALE_PLAN_TIERS,
  TRIAL_INCLUDES_ADDONS,
  isAddonFeature,
  isSalePlanTier,
  featureLockedMessage,
  normalizeAddons,
  getEnabledFeatures,
  getVinLookupBaseQuota,
  hasLifetimeLite,
  planLabel,
  type PlanTier,
} from "@/lib/plan"

function wsFields(over: Partial<Parameters<typeof getPlanState>[0]> = {}) {
  return {
    planTier: "pro" as const,
    subscriptionStatus: "active" as const,
    approvalStatus: "approved" as const,
    trialEndsAt: null,
    currentPeriodEnd: null,
    addons: [] as string[],
    ...over,
  }
}

test("active subscription past currentPeriodEnd locks as subscription_expired", () => {
  const past = new Date(Date.now() - 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: past }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("subscription_expired")
})

test("trial end skips weekends and preserves the verification time", () => {
  const friday = new Date("2026-08-28T07:30:00.000Z") // İstanbul 10:30
  expect(computeTrialEnd(friday).toISOString()).toBe("2026-09-08T07:30:00.000Z")
})

test("trial countdown reports business days instead of calendar days", () => {
  const start = new Date("2026-08-28T07:30:00.000Z")
  const end = computeTrialEnd(start)
  expect(businessDaysUntil(start, end)).toBe(7)
  expect(businessDaysUntil(new Date("2026-08-29T07:30:00.000Z"), end)).toBe(7)
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

// #782: tek paket. Ek özellikler (şaseden parça, ruhsat OCR, e-Fatura, çoklu
// şube) Servis Paketi'ne dahil değil; yalnız "Paket + ek özellikler" profili
// (premium — deneme / elle verilen) açar.
test("satışta yalnız Servis Paketi var", () => {
  expect(SALE_PLAN_TIERS).toEqual(["pro"])
  expect(isSalePlanTier("pro")).toBe(true)
  for (const tier of ["lite", "starter", "premium"]) expect(isSalePlanTier(tier)).toBe(false)
  expect(PLAN_LABELS.pro).toBe("Servis Paketi")
  expect(PLAN_LABELS.premium).toBe("Paket + ek özellikler")
})

test("ek özellikler Servis Paketi'nde kapalı, Paket + ek özellikler profilinde açık", () => {
  expect([...ADDON_FEATURES]).toEqual(["vinLookup", "partsCatalog", "ocrIntake", "eInvoice", "multiBranch"])
  for (const feature of ADDON_FEATURES) {
    expect(isAddonFeature(feature)).toBe(true)
    expect(hasFeature("pro", feature)).toBe(false)
    expect(hasFeature("starter", feature)).toBe(false)
    expect(hasFeature("lite", feature)).toBe(false)
    expect(hasFeature("premium", feature)).toBe(true)
  }
})

test("Servis Paketi ek özellikler dışındaki her yeteneği içerir", () => {
  const packageFeatures = GATED_FEATURES.filter((feature) => !isAddonFeature(feature))
  expect(packageFeatures.every((feature) => hasFeature("pro", feature))).toBe(true)
  expect(GATED_FEATURES.filter((feature) => !hasFeature("pro", feature))).toEqual([
    "ocrIntake", "eInvoice", "multiBranch", "vinLookup", "partsCatalog",
  ])
})

test("plaka okuma pakete dahil — ruhsat OCR ek özelliktir", () => {
  expect(isAddonFeature("plateScan")).toBe(false)
  expect(hasFeature("pro", "plateScan")).toBe(true)
  expect(hasFeature("starter", "plateScan")).toBe(true)
  expect(hasFeature("premium", "plateScan")).toBe(true)
  expect(hasFeature("lite", "plateScan")).toBe(false)
  expect(hasFeature("pro", "ocrIntake")).toBe(false)
  expect(() => assertFeature(wsFields({ planTier: "pro" }), "plateScan")).not.toThrow()
})

// --- canWrite matrix: read-only lock on plan expiry -------------------------

test("canWrite is true for an active in-period subscription", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  expect(getPlanState(wsFields({ currentPeriodEnd: future })).canWrite).toBe(true)
})

test("deneme koltuk limiti paketle aynı: özellik profili premium olsa da 5 (#938)", () => {
  const future = new Date(Date.now() + 3 * 86_400_000)
  const trial = wsFields({ planTier: "pro", subscriptionStatus: "trialing", trialEndsAt: future })
  const paid = wsFields({ planTier: "pro", subscriptionStatus: "active", currentPeriodEnd: future })
  expect(TRIAL_SEAT_LIMIT).toBe(PLAN_SEATS.pro)
  expect(getPlanState(trial).accessTier).toBe(TRIAL_ACCESS_TIER)
  expect(getPlanState(trial).includedSeats).toBe(5)
  expect(getEffectiveSeatLimit(trial)).toBe(getEffectiveSeatLimit(paid))
  expect(getEffectiveSeatLimit({ ...trial, extraSeats: 2 })).toBe(7)
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
test("canWrite is false for a pending workshop (e-mail not verified — server-side gate)", () => {
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

test("assertWriteAccess throws the e-mail verification message for a pending workshop", () => {
  try {
    assertWriteAccess(wsFields({ approvalStatus: "pending", subscriptionStatus: "trialing" }))
    throw new Error("expected throw")
  } catch (e) {
    expect(e).toBeInstanceOf(PlanWriteLockedError)
    expect((e as PlanWriteLockedError).lockReason).toBe("pending")
    expect((e as Error).message).toBe(
      "Hesabınız e-posta doğrulaması bekliyor. Devam etmek için e-posta adresinizi doğrulayın."
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

test("Servis Paketi 5 kullanıcı içerir; fazlası için iletişim önerilir", () => {
  expect(PLAN_SEATS.pro).toBe(5)
  const message = seatLimitMessage("pro", 5, 5)
  expect(message).toContain("(5/5)")
  expect(message).toContain("Ek kullanıcı için bizimle iletişime geçin")
  // Tek paket var — "yükseltin" diyecek bir üst paket yok.
  expect(message).not.toContain("yükselt")
  // Sessiz bir "işlem başarısız" kabul edilemez — metin ne yapılacağını söylemeli.
  expect(message).not.toBe("İşlem başarısız")
})

test("tek koltuklu eski pakette mesaj nedeni ve Servis Paketi çıkışını anlatır", () => {
  const message = seatLimitMessage("starter", 1, 1)
  expect(message).toContain("(1/1)")
  expect(message).toContain("Başlangıç")
  expect(message).toContain("tek kullanıcı")
  expect(message).toContain("5 kullanıcılı Servis Paketi")
})

// --- Eski satırlar (lite / starter / premium) ---------------------------------

test("eski Lite satırı okunur kalır", () => {
  expect(PLAN_SEATS.lite).toBe(1)
  expect(PLAN_LABELS.lite).toBe("Lite (eski)")
  expect(VIN_LOOKUP_QUOTA.lite).toBe(0)
})

test("enum eski paketleri okunur tutar — tip ve doğrulama kırılmaz", () => {
  expect(PLAN_TIERS).toEqual(["lite", "starter", "pro", "premium"])
  for (const tier of PLAN_TIERS) expect(isPlanTier(tier)).toBe(true)
  expect(isPlanTier("enterprise")).toBe(false)
  expect(isPlanTier(["lite"])).toBe(false)
})

test("eski lite/starter/premium satırları getPlanState'te patlamaz", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  for (const planTier of ["lite", "starter", "premium"] as const) {
    const state = getPlanState(wsFields({ planTier, currentPeriodEnd: future }))
    expect(state.tier).toBe(planTier)
    expect(state.accessTier).toBe(planTier)
    expect(state.hasAccess).toBe(true)
  }
  const lifetimeLite = getPlanState(wsFields({ planTier: "lite", liteFreeGrantedAt: new Date() }))
  expect(lifetimeLite.hasAccess).toBe(true)
  expect(lifetimeLite.accessTier).toBe("lite")
})

// Eski Lite kampanyasının süresiz hakkı (lite-campaign.ts'ten taşındı, #830).
const lifetimeLiteFields = {
  planTier: "lite" as const,
  liteFreeGrantedAt: new Date(),
  approvalStatus: "approved" as const,
  subscriptionStatus: "active" as const,
  trialEndsAt: null,
  currentPeriodEnd: null,
}

test("süresiz eski Lite hakkı bayat abonelik durumuyla sona ermez", () => {
  for (const subscriptionStatus of ["active", "trialing", "past_due", "canceled"] as const) {
    const state = getPlanState({ ...lifetimeLiteFields, subscriptionStatus, trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) })
    expect(state).toMatchObject({ hasAccess: true, canWrite: true, isTrialing: false, accessTier: "lite", trialDaysLeft: null, subscriptionDaysLeft: null, currentPeriodEnd: null })
  }
})

test("süresiz Lite hakkı doğrulama/askı kapısını aşmaz ve ücretli pakete yetki vermez", () => {
  for (const approvalStatus of ["pending", "rejected"] as const) {
    expect(getPlanState({ ...lifetimeLiteFields, approvalStatus }).hasAccess).toBe(false)
  }
  expect(hasLifetimeLite(lifetimeLiteFields)).toBe(true)
  expect(hasLifetimeLite({ ...lifetimeLiteFields, planTier: "pro" })).toBe(false)
  expect(hasLifetimeLite({ ...lifetimeLiteFields, liteFreeGrantedAt: null })).toBe(false)
  expect(getPlanState({ ...lifetimeLiteFields, planTier: "pro", currentPeriodEnd: new Date(0) }).hasAccess).toBe(false)
  expect(getPlanState({ ...lifetimeLiteFields, liteFreeGrantedAt: null, currentPeriodEnd: new Date(0) }).hasAccess).toBe(false)
})

test("planLabel dört paketi tek kaynaktan adlandırır, bilinmeyeni ham bırakır", () => {
  expect(planLabel("lite")).toBe("Lite (eski)")
  expect(planLabel("starter")).toBe("Başlangıç (eski)")
  expect(planLabel("pro")).toBe("Servis Paketi")
  expect(planLabel("premium")).toBe("Paket + ek özellikler")
  for (const tier of PLAN_TIERS) expect(planLabel(tier)).toBe(PLAN_LABELS[tier])
  expect(planLabel("enterprise")).toBe("enterprise")
  expect(planLabel(null)).toBe("—")
  expect(planLabel(undefined)).toBe("—")
  expect(planLabel("")).toBe("—")
})

test("photoChecklist is gated to starter tier and above", () => {
  expect(hasFeature("lite", "photoChecklist")).toBe(false)
  expect(hasFeature("starter", "photoChecklist")).toBe(true)
  expect(hasFeature("pro", "photoChecklist")).toBe(true)
  expect(hasFeature("premium", "photoChecklist")).toBe(true)
})

test("damageMap is gated to starter tier and above", () => {
  expect(hasFeature("lite", "damageMap")).toBe(false)
  expect(hasFeature("starter", "damageMap")).toBe(true)
  expect(hasFeature("pro", "damageMap")).toBe(true)
  expect(hasFeature("premium", "damageMap")).toBe(true)
})

test("Lite has only the manual core and no gated capabilities", () => {
  for (const feature of GATED_FEATURES) {
    expect(hasFeature("lite", feature)).toBe(false)
  }
})

test("eski Başlangıç fotoğraf, plaka, katalog sipariş, kasa ve pasaport haklarını korur; ek özellikler çıktı", () => {
  const starterFeatures = GATED_FEATURES.filter((feature) => hasFeature("starter", feature))
  expect(starterFeatures).toEqual([
    "plateScan",
    "photoChecklist",
    "damageMap",
    "bakimxCatalog",
    "getirbakimCatalog",
    "cashbox",
    "vehiclePassport",
  ])
})

test("aktif deneme TRIAL_ACCESS_TIER'a çözülür ve ek özellikleri açar", () => {
  expect(TRIAL_INCLUDES_ADDONS).toBe(true)
  expect(TRIAL_ACCESS_TIER).toBe("premium")
  const trial = wsFields({
    planTier: "pro",
    subscriptionStatus: "trialing",
    trialEndsAt: new Date(Date.now() + 86_400_000),
  })
  expect(getPlanState(trial).accessTier).toBe(TRIAL_ACCESS_TIER)
  for (const feature of ADDON_FEATURES) expect(hasWorkshopFeature(trial, feature)).toBe(true)
  expect(hasWorkshopFeature(trial, "plateScan")).toBe(true)
  expect(getEffectiveSeatLimit({ ...trial, extraSeats: 2 })).toBe(TRIAL_SEAT_LIMIT + 2)
})

test("ücretli Servis Paketi ek özellikleri açmaz", () => {
  const paid = wsFields({ planTier: "pro", currentPeriodEnd: new Date(Date.now() + 86_400_000) })
  expect(getPlanState(paid).accessTier).toBe("pro")
  for (const feature of ADDON_FEATURES) expect(hasWorkshopFeature(paid, feature)).toBe(false)
  expect(getEffectiveSeatLimit({ ...paid, extraSeats: 0 })).toBe(5)
})

test("a pending workshop does not gain trial entitlements before approval", () => {
  const pending = wsFields({
    planTier: "pro",
    subscriptionStatus: "trialing",
    approvalStatus: "pending",
    trialEndsAt: new Date(Date.now() + 86_400_000),
  })
  expect(getPlanState(pending).accessTier).toBe("pro")
  expect(hasWorkshopFeature(pending, "multiBranch")).toBe(false)
})

test("ek özellik kilidi Ayarlar → Paketler'e ve iletişime yönlendirir; kod sabit kalır", () => {
  try {
    assertFeature(wsFields({ planTier: "pro" }), "vinLookup")
    throw new Error("expected throw")
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFeatureLockedError)
    const locked = error as PlanFeatureLockedError
    expect(locked.code).toBe("feature_locked")
    expect(locked.addon).toBe(true)
    expect(locked.requiredTier).toBe("premium")
    expect(locked.message).toBe(ADDON_LOCKED_MESSAGE)
    expect(locked.message).toBe(
      "Bu özellik pakete dahil değildir. Ayarlar → Paketler’den ek özellik olarak satın alabilirsiniz.",
    )
  }
})

test("eski satırda kapalı paket özelliği 'paketinizde bulunmuyor' der", () => {
  try {
    assertFeature(wsFields({ planTier: "lite" }), "appointments")
    throw new Error("expected throw")
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFeatureLockedError)
    const locked = error as PlanFeatureLockedError
    expect(locked.addon).toBe(false)
    expect(locked.code).toBe("feature_locked")
    expect(locked.message).toBe("Bu özellik paketinizde bulunmuyor.")
  }
  expect(featureLockedMessage("ocrIntake")).toBe(ADDON_LOCKED_MESSAGE)
  expect(featureLockedMessage("multiBranch")).toBe(ADDON_CONTACT_LOCKED_MESSAGE)
  expect(featureLockedMessage("eInvoice")).toBe(ADDON_CONTACT_LOCKED_MESSAGE)
  expect(featureLockedMessage("eInvoice")).not.toContain("satın alabilirsiniz")
  expect(featureLockedMessage("cashbox")).toBe("Bu özellik paketinizde bulunmuyor.")
})

// --- VIN quota tests ---------------------------------------------------------

test("şaseden parça ek özellik olduğu için Servis Paketi'nin VIN kotası 0", () => {
  const quotas: Record<PlanTier, number> = { lite: 0, starter: 0, pro: 0, premium: 15_000 }
  expect(VIN_LOOKUP_QUOTA).toEqual(quotas)
})

// ——— Atölye bazında ek özellik (#827) ———

test("normalizeAddons bilinmeyeni atar, tekilleştirir ve ADDON_FEATURES sırasına dizer", () => {
  expect(normalizeAddons(["multiBranch", "bilinmeyen", "vinLookup", "multiBranch"])).toEqual(["vinLookup", "multiBranch"])
  expect(normalizeAddons([])).toEqual([])
  expect(normalizeAddons(null)).toEqual([])
  expect(normalizeAddons(undefined)).toEqual([])
})

test("pro + ['ocrIntake'] yalnız OCR'ı açar", () => {
  const ws = wsFields({ addons: ["ocrIntake"] })
  for (const feature of ADDON_FEATURES) {
    expect(hasWorkshopFeature(ws, feature)).toBe(feature === "ocrIntake")
  }
  expect(hasWorkshopFeature(ws, "appointments")).toBe(true)
})

test("bilinmeyen addons dizesi yok sayılır", () => {
  const ws = wsFields({ addons: ["uydurma"] })
  expect(ADDON_FEATURES.some((feature) => hasWorkshopFeature(ws, feature))).toBe(false)
})

test("premium + [] ek özelliklerin hepsini açar", () => {
  const ws = wsFields({ planTier: "premium" })
  expect(ADDON_FEATURES.every((feature) => hasWorkshopFeature(ws, feature))).toBe(true)
})

test("aktif deneme + [] hepsini açar; biten deneme yalnız addons'ı", () => {
  const future = new Date(Date.now() + 3 * 86_400_000)
  const past = new Date(Date.now() - 86_400_000)
  const active = wsFields({ subscriptionStatus: "trialing", trialEndsAt: future })
  expect(ADDON_FEATURES.every((feature) => hasWorkshopFeature(active, feature))).toBe(true)

  const ended = wsFields({ subscriptionStatus: "trialing", trialEndsAt: past, addons: ["eInvoice"] })
  expect(hasWorkshopFeature(ended, "eInvoice")).toBe(true)
  expect(hasWorkshopFeature(ended, "ocrIntake")).toBe(false)
})

test("eski lite/starter satırında da addons geçerlidir", () => {
  expect(hasWorkshopFeature(wsFields({ planTier: "lite", addons: ["vinLookup"] }), "vinLookup")).toBe(true)
  expect(hasWorkshopFeature(wsFields({ planTier: "starter", addons: ["multiBranch"] }), "multiBranch")).toBe(true)
})

test("assertFeature ek özellik açıkken geçer, kapalıyken fırlatır", () => {
  expect(() => assertFeature(wsFields({ addons: ["vinLookup"] }), "vinLookup")).not.toThrow()
  expect(() => assertFeature(wsFields(), "vinLookup")).toThrow(PlanFeatureLockedError)
})

test("getEnabledFeatures paket özellikleri + açık ek özellikleri verir", () => {
  const pro = getEnabledFeatures(wsFields())
  expect(ADDON_FEATURES.some((feature) => pro.includes(feature))).toBe(false)
  expect(pro).toContain("appointments")
  const withOcr = getEnabledFeatures(wsFields({ addons: ["ocrIntake"] }))
  expect(withOcr).toContain("ocrIntake")
  expect(withOcr).not.toContain("vinLookup")
  expect(getEnabledFeatures(wsFields({ planTier: "premium" }))).toEqual([...GATED_FEATURES])
})

test("getVinLookupBaseQuota: pro 0, vinLookup ya da partsCatalog 15.000, premium 15.000", () => {
  expect(getVinLookupBaseQuota(wsFields())).toBe(0)
  expect(getVinLookupBaseQuota(wsFields({ addons: ["vinLookup"] }))).toBe(15_000)
  expect(getVinLookupBaseQuota(wsFields({ addons: ["partsCatalog"] }))).toBe(15_000)
  expect(getVinLookupBaseQuota(wsFields({ addons: ["ocrIntake"] }))).toBe(0)
  expect(getVinLookupBaseQuota(wsFields({ planTier: "premium" }))).toBe(15_000)
})

test("satılmayan ek özellik kapıları ADDON_CATALOG'daki purchasable:false ile aynı", () => {
  const catalogContactOnly = ADDON_CATALOG.filter((a) => !a.purchasable).flatMap((a) => [...a.features])
  expect([...CONTACT_ONLY_ADDON_FEATURES].sort()).toEqual(catalogContactOnly.sort())
})
