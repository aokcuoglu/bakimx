import { computeTrialEnd, type SalePlanTier } from "@/lib/plan"

/**
 * Kayıt denemesinin tek sözleşmesi (#782). Ücretsiz paket yok: yarım kalmış
 * her kayıt — eski `lite` (ücretsiz hak işaretli) ya da `premium` seçimiyle
 * başlamış olsa bile — Servis Paketi'nin 7 iş günlük denemesi olarak tamamlanır.
 * Zaten etkin eski Lite atölyelerine dokunulmaz; bu veriler yalnız henüz
 * doğrulanmamış (`pending`) satırlara yazılır.
 */
export const REGISTRATION_TRIAL_TIER: SalePlanTier = "pro"

/** Yeniden gönderimde: doğrulanmamış kaydı deneme şekline çeker; deneme doğrulamada başlar. */
export function pendingRegistrationPlanData() {
  return {
    planTier: REGISTRATION_TRIAL_TIER,
    subscriptionStatus: "trialing" as const,
    liteFreeGrantedAt: null,
  }
}

/** E-posta doğrulandığında (ya da admin bekleyen kaydı onayladığında) denemeyi başlatır. */
export function verifiedRegistrationTrialData(now: Date) {
  return {
    ...pendingRegistrationPlanData(),
    approvalStatus: "approved" as const,
    trialStartedAt: now,
    trialEndsAt: computeTrialEnd(now),
  }
}
