import { StatusPill } from "@/components/shared/status-badge"
import { QUOTE_STATUS, type QuoteStatusKey } from "@/lib/constants"

export function QuoteStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const info = QUOTE_STATUS[status as QuoteStatusKey]
  return <StatusPill label={info?.label || status} tone={info?.tone} size={size} className={className} />
}
