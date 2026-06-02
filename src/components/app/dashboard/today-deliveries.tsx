import Link from "next/link"
import { StatusBadge, PlateBadge } from "@/components/app/status-badge"
import type { TodayDelivery } from "@/lib/dashboard/queries"

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function TodayDeliveries({ deliveries }: { deliveries: TodayDelivery[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Bugün Teslim Edilecekler</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {deliveries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Bugün teslim edilecek iş emri yok.
          </p>
        ) : (
          deliveries.map((d) => (
            <Link
              key={d.id}
              href={`/app/orders/${d.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <PlateBadge plate={d.plate} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.customerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-slate-400">{d.workOrderNo}</span>
                  {d.estimatedDeliveryAt && (
                    <span className="text-[11px] text-slate-400">{formatTime(d.estimatedDeliveryAt)}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={d.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
