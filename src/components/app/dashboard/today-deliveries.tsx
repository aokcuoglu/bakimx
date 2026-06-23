import Link from "next/link"
import { StatusBadge, PlateBadge } from "@/components/app/status-badge"
import type { TodayDelivery } from "@/lib/dashboard/queries"

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function TodayDeliveries({ deliveries }: { deliveries: TodayDelivery[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Bugün Teslim Edilecekler</h3>
      </div>
      <div className="divide-y divide-border">
        {deliveries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Bugün teslim edilecek iş emri yok.
          </p>
        ) : (
          deliveries.map((d) => (
            <Link
              key={d.id}
              href={`/orders/${d.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <PlateBadge plate={d.plate} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.customerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-muted-foreground/70">{d.workOrderNo}</span>
                  {d.estimatedDeliveryAt && (
                    <span className="text-[11px] text-muted-foreground/70">{formatTime(d.estimatedDeliveryAt)}</span>
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
