import { cn } from "@/lib/utils"
import { APPOINTMENT_STATUS, type AppointmentStatusKey } from "@/lib/constants"

export function AppointmentStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const info = APPOINTMENT_STATUS[status as AppointmentStatusKey]
  const label = info?.label || status
  const color = info?.color || "bg-slate-100 text-slate-700 border-slate-200"

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
