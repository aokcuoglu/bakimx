import Link from "next/link"
import { AlertTriangle, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CriticalStockItem } from "@/lib/parts/queries"

export function CriticalStockWidget({ items }: { items: CriticalStockItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-destructive/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Kritik Stok</h3>
        </div>
        <Link href="/app/parts?status=critical" className="text-xs text-destructive hover:text-destructive font-medium">
          Tümünü Gör →
        </Link>
      </div>
      <div className="divide-y divide-destructive/20">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.id}
            href={`/app/parts/${item.id}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-destructive/10 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {item.sku && <span className="font-mono">{item.sku}</span>}
                {item.oemNo && <span>{item.oemNo}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                   item.status === "out_of_stock"
                      ? "bg-muted text-muted-foreground"
                      : "bg-destructive/10 text-foreground"
                )}
              >
                <Package className="size-3" />
                {item.stockQty}
              </span>
              {item.criticalStockQty > 0 && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Kritik: {item.criticalStockQty}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {items.length > 5 && (
        <Link
          href="/app/parts?status=critical"
          className="block px-4 py-2 text-xs text-center text-destructive hover:text-destructive font-medium border-t border-destructive/20"
        >
          +{items.length - 5} kritik parça daha
        </Link>
      )}
    </div>
  )
}
