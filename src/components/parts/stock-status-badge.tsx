import { StatusPill } from "@/components/shared/status-badge"
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
  return <StatusPill label={info?.label || "Bilinmiyor"} tone={info?.tone} size={size} className={className} />
}
