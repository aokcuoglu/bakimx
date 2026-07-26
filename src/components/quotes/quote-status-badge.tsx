import { cn } from "@/lib/utils"
import { QUOTE_STATUS, type QuoteStatusKey } from "@/lib/constants"

export function QuoteStatusBadge({ status, size = "sm", className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const info = QUOTE_STATUS[status as QuoteStatusKey]
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
