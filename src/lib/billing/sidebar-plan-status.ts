import type { PlanState } from "@/lib/plan"

export type SidebarPlanStatus = {
  title: string
  detail: string
  action: string
}

/** Denemenin her yüzeyde aynı adı (#782 — satışta artık "Premium" yok). */
export const TRIAL_PLAN_NAME = "Ücretsiz deneme"

/** Keep the sidebar copy aligned with the effective trial entitlement. */
export function getSidebarPlanStatus(plan: PlanState, planName: string): SidebarPlanStatus {
  if (plan.isTrialing) {
    return {
      title: plan.trialDaysLeft == null
        ? "Deneme sürüyor"
        : plan.trialDaysLeft === 0
          ? "Deneme bugün bitiyor"
          : `${plan.trialDaysLeft} iş günü kaldı`,
      detail: TRIAL_PLAN_NAME,
      action: "Paketi al",
    }
  }
  if (!plan.hasAccess) {
    return { title: "Abonelik sona erdi", detail: planName, action: "Yenile" }
  }
  if (plan.tier === "lite") {
    return { title: "Lite · ücretsiz", detail: "Servis Paketi'ne geçebilirsiniz", action: "İncele" }
  }
  return {
    title: planName,
    detail: plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7
      ? `${plan.subscriptionDaysLeft} gün kaldı`
      : "Abonelik aktif",
    action: "Yönet",
  }
}
