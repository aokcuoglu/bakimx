import type { StatusIncidentSeverity } from "@prisma/client"

/** Genel platform durumu. `operational` çözülmemiş (aktif) olay yokken geçerlidir. */
export type OverallStatus = "operational" | StatusIncidentSeverity

const SEVERITY_RANK: Record<StatusIncidentSeverity, number> = {
  degraded: 1,
  major_outage: 2,
}

/**
 * Genel durum, aktif (çözülmemiş) olayların EN YÜKSEK ciddiyetinden türetilir —
 * satır bazlı bir "durum" alanı tutmuyoruz ki tek kaynak `resolvedAt` kalsın.
 */
export function deriveOverallStatus(activeSeverities: StatusIncidentSeverity[]): OverallStatus {
  if (activeSeverities.length === 0) return "operational"
  return activeSeverities.reduce<StatusIncidentSeverity>(
    (worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst),
    activeSeverities[0]
  )
}

export const OVERALL_STATUS_LABELS: Record<OverallStatus, string> = {
  operational: "Tüm sistemler çalışıyor",
  degraded: "Performans düşüşü",
  major_outage: "Büyük kesinti",
}

export const SEVERITY_LABELS: Record<StatusIncidentSeverity, string> = {
  degraded: "Performans düşüşü",
  major_outage: "Büyük kesinti",
}
