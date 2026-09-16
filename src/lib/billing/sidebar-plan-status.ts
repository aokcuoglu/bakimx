import type { PlanState } from "@/lib/plan"

export type SidebarPlanStatus = {
  title: string
  detail: string
  action: string
}

/** Keep the sidebar copy aligned with the effective trial entitlement. */
export function getSidebarPlanStatus(plan: PlanState, planName: string): SidebarPlanStatus {
  if (plan.isTrialing) {
    return {
      title: plan.trialDaysLeft == null
        ? "Premium denemesi"
        : plan.trialDaysLeft === 0
          ? "Deneme bugün bitiyor"
          : `${plan.trialDaysLeft} iş günü kaldı`,
      detail: "Premium denemesi",
      action: "Paket seç",
    }
  }
  if (!plan.hasAccess) {
    return { title: "Abonelik sona erdi", detail: planName, action: "Yenile" }
  }
  if (plan.tier === "lite") {
    return { title: "Lite · ücretsiz", detail: "Paketinizi yükseltebilirsiniz", action: "İncele" }
  }
  return {
    title: planName,
    detail: plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7
      ? `${plan.subscriptionDaysLeft} gün kaldı`
      : "Abonelik aktif",
    action: "Yönet",
  }
}
