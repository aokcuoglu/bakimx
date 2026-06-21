import type { ServiceAnalytics as ServiceAnalyticsType } from "@/lib/analytics/queries"
import { formatTRY } from "@/lib/format"
import { MessageSquare, Wrench, HardHat } from "lucide-react"

function TopList({ title, icon: Icon, items, renderRight }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: { name: string; count: number; extra?: string }[]
  renderRight?: (item: { name: string; count: number; extra?: string }) => React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Veri bulunmuyor.</div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 sm:px-6 py-3">
              <div className="flex items-center gap-3">
                <span className="size-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-none">{item.name}</p>
                  {item.extra && <p className="text-xs text-muted-foreground">{item.extra}</p>}
                </div>
              </div>
              {renderRight ? renderRight(item) : (
                <span className="text-sm font-semibold text-foreground">{item.count}×</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ServiceAnalyticsSection({ analytics }: { analytics: ServiceAnalyticsType }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <TopList
        title="En Sık Şikayetler"
        icon={MessageSquare}
        items={analytics.topComplaints.map((c) => ({
          name: c.complaint,
          count: c.count,
        }))}
      />
      <TopList
        title="En Sık Onarımlar"
        icon={Wrench}
        items={analytics.topRepairs.map((r) => ({
          name: r.itemName,
          count: r.count,
          extra: r.type === "part" ? "Parça" : "İşçilik",
        }))}
      />
      <TopList
        title="En Çok Yapılan İşçilikler"
        icon={HardHat}
        items={analytics.topLaborItems.map((l) => ({
          name: l.laborName,
          count: l.count,
          extra: formatTRY(l.totalRevenue),
        }))}
        renderRight={(item) => (
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{item.extra}</p>
            <p className="text-xs text-muted-foreground">{item.count}×</p>
          </div>
        )}
      />
    </div>
  )
}