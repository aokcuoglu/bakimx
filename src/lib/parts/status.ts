export type StockStatus = "in_stock" | "critical" | "out_of_stock" | "inactive"

/**
 * Rozet renkleri tema token'larıyla verilir; ham Tailwind paleti (`slate-400`
 * gibi) tema anahtarına bağlı olmadığı için ne koyu temada döner ne de
 * kontrast kapılarından geçer. Ölçülen oranlar (açık tema, en kötü yüzey):
 * Stokta 4.91:1 · Kritik 4.87:1 · Stokta Yok 16.15:1 · Pasif 5.34:1 —
 * hepsi AA (4.5:1) üstü.
 * Nötr iki durumun sönüklüğü artık renkle değil, dolgusuz/gri yüzeyle veriliyor.
 */
export const STOCK_STATUS = {
  in_stock: { label: "Stokta", color: "bg-success/10 text-success-strong border-success/20" },
  critical: { label: "Kritik Stokta", color: "bg-destructive/10 text-destructive-strong border-destructive/20" },
  out_of_stock: { label: "Stokta Yok", color: "bg-muted text-foreground border-border" },
  inactive: { label: "Pasif", color: "bg-muted/50 text-muted-foreground border-border" },
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
