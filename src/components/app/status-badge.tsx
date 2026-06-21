import { cn } from "@/lib/utils"
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatusKey, type PaymentStatusKey } from "@/lib/constants"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS, COLLECTION_STATUS_LABELS, COLLECTION_STATUS_COLORS } from "@/lib/cashbox/status"
import type { PaymentMethodKey, CollectionStatusKey } from "@/lib/cashbox/status"

type StatusBadgeProps = {
  status: string
  size?: "sm" | "md"
  className?: string
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = ORDER_STATUS[status as OrderStatusKey]
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

export function PaymentBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = PAYMENT_STATUS[status as PaymentStatusKey]
  const label = info?.label || status
  const color = info?.color || "bg-muted text-muted-foreground border-border"

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

export function PaymentMethodBadge({ method, size = "sm", className }: { method: string; size?: "sm" | "md"; className?: string }) {
  const key = method as PaymentMethodKey
  const label = PAYMENT_METHOD_LABELS[key] || method
  const color = PAYMENT_METHOD_COLORS[key] || "bg-muted text-muted-foreground border-border"

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

export function CollectionStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const key = status as CollectionStatusKey
  const label = COLLECTION_STATUS_LABELS[key] || status
  const color = COLLECTION_STATUS_COLORS[key] || "bg-muted text-muted-foreground border-border"

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

export { PlateBadge } from "@/components/app/plate-badge"
