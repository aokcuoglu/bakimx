export type StockStatus = "in_stock" | "critical" | "out_of_stock" | "inactive"

export const STOCK_STATUS = {
  in_stock: { label: "Stokta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  critical: { label: "Kritik Stokta", color: "bg-red-50 text-red-700 border-red-200" },
  out_of_stock: { label: "Stokta Yok", color: "bg-slate-100 text-slate-500 border-slate-200" },
  inactive: { label: "Pasif", color: "bg-slate-50 text-slate-400 border-slate-100" },
} as const

export function getStockStatus(stockQty: number, criticalStockQty: number, isActive: boolean): StockStatus {
  if (!isActive) return "inactive"
  if (stockQty <= 0) return "out_of_stock"
  if (stockQty <= criticalStockQty) return "critical"
  return "in_stock"
}

export function getStockStatusLabel(stockQty: number, criticalStockQty: number, isActive: boolean): string {
  return STOCK_STATUS[getStockStatus(stockQty, criticalStockQty, isActive)].label
}

export type StockStatusKey = keyof typeof STOCK_STATUS
