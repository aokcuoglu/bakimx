import { hasLifetimeLite } from "@/lib/plan"

export interface PlanActivationAuditMetadata {
  tier: string
  status: string
  previousTier: string
  previousStatus: string
  /** Yalnız ezilen satır süresiz Lite hakkı taşıyorsa yazılır. */
  hadLifetimeLite?: true
}

/**
 * `admin_plan_activated` kaydının gövdesi. Önceki paket ve durum da yazılır:
 * elle etkinleştirme eski bir satırı (süresiz Lite dahil) Servis Paketi'ne
 * geçirdiğinde iz kalsın, gerekirse geri kurulabilsin (#830).
 */
export function planActivationAuditMetadata(
  previous: { planTier: string; subscriptionStatus: string; liteFreeGrantedAt?: Date | null },
  tier: string,
  status: string,
): PlanActivationAuditMetadata {
  return {
    tier,
    status,
    previousTier: previous.planTier,
    previousStatus: previous.subscriptionStatus,
    ...(hasLifetimeLite(previous) ? { hadLifetimeLite: true as const } : {}),
  }
}
