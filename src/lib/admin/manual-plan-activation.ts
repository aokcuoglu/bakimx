import type { BillingCycle } from "@prisma/client"
import { addPeriod } from "@/lib/billing/period"
import type { ManualPlanActivationInput } from "@/lib/validations/plan-activation"

export interface ManualActivationPeriod {
  billingCycle: BillingCycle | null
  currentPeriodEnd: Date | null
}

/**
 * Elle etkinleştirmede yazılacak dönem (#1040). Süresiz seçimde ikisi de
 * `null` yazılır (eski, süresi dolmuş bir bitiş tarihini de temizler).
 */
export function resolveManualActivationPeriod(input: ManualPlanActivationInput, now: Date): ManualActivationPeriod {
  if (input.indefinite) return { billingCycle: null, currentPeriodEnd: null }
  if (!input.cycle) throw new Error("Dönem veya süresiz erişim seçilmeli.")
  const currentPeriodEnd = addPeriod(now, input.cycle)
  if (currentPeriodEnd.getTime() <= now.getTime()) throw new Error("Dönem bitişi şimdiden sonra olmalı.")
  return { billingCycle: input.cycle, currentPeriodEnd }
}

/** Süresiz Lite hakkı (durumdan bağımsız) ya da aktif ve dönem bitişsiz iş yeri süresiz erişimdedir. */
export function isIndefiniteAccess(w: {
  subscriptionStatus: string
  currentPeriodEnd?: string | Date | null
  lifetimeLite?: boolean
}): boolean {
  return !!w.lifetimeLite || (w.subscriptionStatus === "active" && !w.currentPeriodEnd)
}
