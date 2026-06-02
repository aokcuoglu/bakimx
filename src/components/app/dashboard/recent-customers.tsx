import Link from "next/link"
import type { RecentCustomer } from "@/lib/dashboard/queries"
import { User, ChevronRight } from "lucide-react"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function RecentCustomers({ customers }: { customers: RecentCustomer[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Son Müşteriler</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {customers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Henüz müşteri kaydı yok.
          </p>
        ) : (
          customers.map((c) => (
            <Link
              key={c.id}
              href={`/app/customers/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="size-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <User className="size-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                <p className="text-xs text-slate-400">{c.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                <ChevronRight className="size-3.5 text-slate-300 ml-auto mt-0.5" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
