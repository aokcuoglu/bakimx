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
  const label = info?.label || status
  const color = info?.color || "bg-muted text-foreground border-border"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        color,
        className
      )}
    >
      {label}
    </span>
  )
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
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border bg-muted text-muted-foreground border-border whitespace-nowrap",
        className
      )}
    >
      {labels[type] || type}
    </span>
  )
}
