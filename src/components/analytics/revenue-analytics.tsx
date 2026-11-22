import { HighlightCard } from "@/components/shared/highlight-card"
import type { RevenueAnalytics as RevenueAnalyticsType } from "@/lib/analytics/queries"
import { formatTRY } from "@/lib/format"
import { TrendingUp, Wallet, Receipt, BarChart3 } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return <HighlightCard label={label} value={value} accessory={<Icon />} description={subtitle} />
}

export function RevenueAnalyticsSection({ analytics }: { analytics: RevenueAnalyticsType }) {
  const maxAmount = Math.max(...analytics.collectionTrend.map((m) => m.amount), 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Tahsilat"
          value={formatTRY(analytics.totalCollected)}
          icon={Wallet}
        />
        <StatCard
          label="Açık Alacak"
          value={formatTRY(analytics.totalReceivable)}
          icon={Receipt}
          subtitle={`${analytics.completedOrders} tamamlanan sipariş`}
        />
        <StatCard
          label="Ort. Araç Kabul Tutarı"
          value={analytics.averageTicketSize > 0 ? formatTRY(analytics.averageTicketSize) : "—"}
          icon={BarChart3}
          subtitle="Tamamlanan siparişler"
        />
        <StatCard
          label="Araç Kabul Başı Gelir"
          value={analytics.revenuePerWorkOrder > 0 ? formatTRY(analytics.revenuePerWorkOrder) : "—"}
          icon={TrendingUp}
          subtitle={`${analytics.totalOrders} toplam sipariş`}
        />
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp className="size-4 text-success-strong" />
          <h3 className="text-sm font-medium text-foreground">Tahsilat Trendi (Son 6 Ay)</h3>
        </div>
        <div className="overflow-x-auto p-4">
          {analytics.collectionTrend.every((m) => m.amount === 0) ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Henüz tahsilat verisi bulunmuyor.
            </div>
          ) : (
            <div className="flex min-w-[480px] items-end gap-4 h-48">
              {analytics.collectionTrend.map((m) => {
                const height = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0
                return (
                  <div key={m.month} className="h-full min-w-0 flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium tabular-nums text-foreground">
                      {m.amount > 0 ? formatTRY(m.amount) : "—"}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-primary"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">{m.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}