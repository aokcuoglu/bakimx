import Link from "next/link"
import { AlertTriangle, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CriticalStockItem } from "@/lib/parts/queries"

export function CriticalStockWidget({ items }: { items: CriticalStockItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-600" />
          <h3 className="text-sm font-semibold text-red-900">Kritik Stok</h3>
        </div>
        <Link href="/app/parts?status=critical" className="text-xs text-red-600 hover:text-red-700 font-medium">
          Tümünü Gör →
        </Link>
      </div>
      <div className="divide-y divide-red-100">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.id}
            href={`/app/parts/${item.id}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-red-50/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                {item.sku && <span className="font-mono">{item.sku}</span>}
                {item.oemNo && <span>{item.oemNo}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                  item.status === "out_of_stock"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-red-100 text-red-700"
                )}
              >
                <Package className="size-3" />
                {item.stockQty}
              </span>
              {item.criticalStockQty > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">Kritik: {item.criticalStockQty}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {items.length > 5 && (
        <Link
          href="/app/parts?status=critical"
          className="block px-4 py-2 text-xs text-center text-red-600 hover:text-red-700 font-medium border-t border-red-100"
        >
          +{items.length - 5} kritik parça daha
        </Link>
      )}
    </div>
  )
}
