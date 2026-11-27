import { hasLifetimeLite } from "@/lib/plan"

export interface PlanActivationAuditMetadata {
  tier: string
  status: string
  previousTier: string
  previousStatus: string
  /** Yalnız ezilen satır süresiz Lite hakkı taşıyorsa yazılır. */
  hadLifetimeLite?: true
  /** Seçilen dönem (`monthly` / `yearly`); süresiz erişimde yazılmaz. */
  cycle?: string
  /** Yazılan dönem bitişi (ISO); süresiz erişimde yazılmaz. */
  periodEndsAt?: string
  /** Yalnız süresiz erişim açıkça seçildiyse yazılır (#1040). */
  indefinite?: true
  /** Ezilen önceki dönem bitişi (ISO). */
  previousPeriodEndsAt?: string
}

/**
 * `admin_plan_activated` kaydının gövdesi. Önceki paket ve durum da yazılır:
 * elle etkinleştirme eski bir satırı (süresiz Lite dahil) Servis Paketi'ne
 * geçirdiğinde iz kalsın, gerekirse geri kurulabilsin (#830).
 */
export function planActivationAuditMetadata(
  previous: { planTier: string; subscriptionStatus: string; liteFreeGrantedAt?: Date | null; currentPeriodEnd?: Date | null },
  tier: string,
  status: string,
  period: { billingCycle: string | null; currentPeriodEnd: Date | null },
): PlanActivationAuditMetadata {
  return {
    tier,
    status,
    previousTier: previous.planTier,
    previousStatus: previous.subscriptionStatus,
    ...(hasLifetimeLite(previous) ? { hadLifetimeLite: true as const } : {}),
    ...(period.billingCycle && period.currentPeriodEnd
      ? { cycle: period.billingCycle, periodEndsAt: period.currentPeriodEnd.toISOString() }
      : { indefinite: true as const }),
    ...(previous.currentPeriodEnd ? { previousPeriodEndsAt: previous.currentPeriodEnd.toISOString() } : {}),
  }
}
