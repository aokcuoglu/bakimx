import { cn } from "@/lib/utils"
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatusKey, type PaymentStatusKey } from "@/lib/constants"

type StatusBadgeProps = {
  status: string
  size?: "sm" | "md"
  className?: string
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = ORDER_STATUS[status as OrderStatusKey]
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

export function PaymentBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = PAYMENT_STATUS[status as PaymentStatusKey]
  const label = info?.label || status
  const color = info?.color || "bg-slate-50 text-slate-500 border-slate-200"

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

export function PlateBadge({ plate, className }: { plate: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[5rem] h-7 px-2.5 rounded-md bg-[#0B1F3A] text-white font-mono text-xs font-semibold tracking-wider shadow-sm",
        className
      )}
    >
      {plate}
    </span>
  )
}
