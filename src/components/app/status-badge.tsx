import { cn } from "@/lib/utils"
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatusKey, type PaymentStatusKey } from "@/lib/constants"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS, COLLECTION_STATUS_LABELS, COLLECTION_STATUS_COLORS } from "@/lib/cashbox/status"
import type { PaymentMethodKey, CollectionStatusKey } from "@/lib/cashbox/status"

type PillSize = "sm" | "md" | "lg"

type StatusBadgeProps = {
  status: string
  size?: PillSize
  className?: string
}

const DEFAULT_PILL_COLOR = "bg-muted text-foreground border-border"

// Presentational pill — the single source of truth for badge visuals across
// the app (status, payment, method, collection). Pass a resolved label + color.
export function StatusPill({
  label,
  color,
  size = "sm",
  className,
}: {
  label: string
  color?: string
  size?: PillSize
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[11px]" : size === "lg" ? "h-7 px-3 text-xs" : "h-6 px-2.5 text-xs",
        color || DEFAULT_PILL_COLOR,
        className
      )}
    >
      {label}
    </span>
  )
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = ORDER_STATUS[status as OrderStatusKey]
  return <StatusPill label={info?.label || status} color={info?.color} size={size} className={className} />
}

export function PaymentBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = PAYMENT_STATUS[status as PaymentStatusKey]
  return <StatusPill label={info?.label || status} color={info?.color} size={size} className={className} />
}

export function PaymentMethodBadge({ method, size = "sm", className }: { method: string; size?: "sm" | "md"; className?: string }) {
  const key = method as PaymentMethodKey
  return <StatusPill label={PAYMENT_METHOD_LABELS[key] || method} color={PAYMENT_METHOD_COLORS[key]} size={size} className={className} />
}

export function CollectionStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const key = status as CollectionStatusKey
  return <StatusPill label={COLLECTION_STATUS_LABELS[key] || status} color={COLLECTION_STATUS_COLORS[key]} size={size} className={className} />
}

export { PlateBadge } from "@/components/app/plate-badge"
