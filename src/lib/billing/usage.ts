export type UsageTone = "normal" | "warning" | "critical"

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)))
}

export function usageTone(used: number, limit: number): UsageTone {
  const percent = usagePercent(used, limit)
  if (percent >= 90) return "critical"
  if (percent >= 70) return "warning"
  return "normal"
}

export const USAGE_TONE_LABELS: Record<UsageTone, string> = {
  normal: "Normal",
  warning: "Uyarı",
  critical: "Kritik",
}

export function summarizeSeatUsage(input: {
  activeUsers: number
  pendingInvites: number
  includedSeats: number
  extraSeats: number
}) {
  const activeUsers = Math.max(0, input.activeUsers)
  const pendingInvites = Math.max(0, input.pendingInvites)
  const includedSeats = Math.max(0, input.includedSeats)
  const extraSeats = Math.max(0, input.extraSeats)
  return {
    activeUsers,
    pendingInvites,
    includedSeats,
    extraSeats,
    used: activeUsers + pendingInvites,
    limit: includedSeats + extraSeats,
  }
}
