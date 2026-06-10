import Link from "next/link"
import { Truck } from "lucide-react"
import type { CriticalSupplierInfo } from "@/lib/suppliers/queries"

export function CriticalStockSuppliersWidget({ suppliers }: { suppliers: CriticalSupplierInfo[] }) {
  if (suppliers.length === 0) return null

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-indigo-900">Kritik Stok Tedarikçileri</h3>
        </div>
        <Link href="/app/suppliers" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
          Tümünü Gör →
        </Link>
      </div>
      <div className="divide-y divide-indigo-100">
        {suppliers.map((s) => (
          <Link
            key={s.id}
            href={`/app/suppliers/${s.id}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-indigo-50/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
              {s.phone && <p className="text-xs text-slate-500 mt-0.5">{s.phone}</p>}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
              {s.criticalPartCount} parça
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}