import Link from "next/link"
import { Truck } from "lucide-react"
import type { CriticalSupplierInfo } from "@/lib/suppliers/queries"

export function CriticalStockSuppliersWidget({ suppliers }: { suppliers: CriticalSupplierInfo[] }) {
  if (suppliers.length === 0) return null

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-primary">Kritik Stok Tedarikçileri</h3>
        </div>
        <Link href="/suppliers" className="text-xs text-primary hover:text-primary/80 font-medium">
          Tümünü Gör →
        </Link>
      </div>
      <div className="divide-y divide-primary/10">
        {suppliers.map((s) => (
          <Link
            key={s.id}
            href={`/suppliers/${s.id}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-primary/5 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              {s.phone && <p className="text-xs text-muted-foreground mt-0.5">{s.phone}</p>}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
              {s.criticalPartCount} parça
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}