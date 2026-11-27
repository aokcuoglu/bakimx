import { StatusPill } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MAINTENANCE_REMINDER_STATUS, type MaintenanceReminderStatusKey } from "@/lib/constants"

export function ReminderStatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: string
  size?: "sm" | "md"
  className?: string
}) {
  const info = MAINTENANCE_REMINDER_STATUS[status as MaintenanceReminderStatusKey]
  return <StatusPill label={info?.label || status} tone={info?.tone} size={size} className={className} />
}

export function ReminderTypeBadge({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  const labels: Record<string, string> = {
    periodic_maintenance: "Periyodik Bakım",
    oil_change: "Yağ Bakımı",
    inspection: "Muayene",
    tire_change: "Lastik Değişimi",
    brake_check: "Fren Kontrolü",
    battery_check: "Akü Kontrolü",
    insurance: "Sigorta",
    other: "Diğer",
  }
  return (
    <Badge variant="secondary" className={cn("h-5 px-2 text-[11px]", className)}>
      {labels[type] || type}
    </Badge>
  )
}
