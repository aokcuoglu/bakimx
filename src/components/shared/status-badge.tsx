import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatusKey, type PaymentStatusKey } from "@/lib/constants"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_TONES, COLLECTION_STATUS_LABELS, COLLECTION_STATUS_TONES } from "@/lib/cashbox/status"
import type { PaymentMethodKey, CollectionStatusKey } from "@/lib/cashbox/status"
import { statusToneBadgeVariant, type StatusTone } from "@/lib/status-tone"

type PillSize = "sm" | "md" | "lg"

type StatusBadgeProps = {
  status: string
  size?: PillSize
  className?: string
}

// Presentational pill — the single source of truth for badge visuals across
// the app (status, payment, method, collection). Pass a resolved label + tone;
// the tone maps to a `Badge` tint variant (#1021).
export function StatusPill({
  label,
  tone,
  size = "sm",
  className,
}: {
  label: string
  tone?: StatusTone
  size?: PillSize
  className?: string
}) {
  return (
    <Badge
      variant={statusToneBadgeVariant(tone)}
      className={cn(
        size === "sm" ? "h-5 px-2 text-[11px]" : size === "lg" ? "h-7 px-3 text-xs" : "h-6 px-2.5 text-xs",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = ORDER_STATUS[status as OrderStatusKey]
  return <StatusPill label={info?.label || status} tone={info?.tone} size={size} className={className} />
}

export function PaymentBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const info = PAYMENT_STATUS[status as PaymentStatusKey]
  return <StatusPill label={info?.label || status} tone={info?.tone} size={size} className={className} />
}

export function PaymentMethodBadge({ method, size = "sm", className }: { method: string; size?: "sm" | "md"; className?: string }) {
  const key = method as PaymentMethodKey
  return <StatusPill label={PAYMENT_METHOD_LABELS[key] || method} tone={PAYMENT_METHOD_TONES[key]} size={size} className={className} />
}

export function CollectionStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const key = status as CollectionStatusKey
  return <StatusPill label={COLLECTION_STATUS_LABELS[key] || status} tone={COLLECTION_STATUS_TONES[key]} size={size} className={className} />
}
