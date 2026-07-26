import { cn } from "@/lib/utils"
import { STOCK_STATUS, getStockStatus, type StockStatusKey } from "@/lib/parts/status"

export function StockStatusBadge({
  stockQty,
  criticalStockQty,
  isActive = true,
  size = "sm",
  className,
}: {
  stockQty: number
  criticalStockQty: number
  isActive?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const status = getStockStatus(stockQty, criticalStockQty, isActive)
  const info = STOCK_STATUS[status as StockStatusKey]
  const label = info?.label || "Bilinmiyor"
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
