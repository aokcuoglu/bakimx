import { StatusPill } from "@/components/shared/status-badge"
import { APPOINTMENT_STATUS, type AppointmentStatusKey } from "@/lib/constants"

export function AppointmentStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const info = APPOINTMENT_STATUS[status as AppointmentStatusKey]
  return <StatusPill label={info?.label || status} tone={info?.tone} size={size} className={className} />
}
