import type { RevenueAnalytics as RevenueAnalyticsType } from "@/lib/analytics/queries"
import { formatTRY } from "@/lib/format"
import { TrendingUp, Wallet, Receipt, BarChart3 } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon, accent, accentBg }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`size-8 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function RevenueAnalyticsSection({ analytics }: { analytics: RevenueAnalyticsType }) {
  const maxAmount = Math.max(...analytics.collectionTrend.map((m) => m.amount), 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Tahsilat"
          value={formatTRY(analytics.totalCollected)}
          icon={Wallet}
          accent="text-emerald-600"
          accentBg="bg-emerald-100"
        />
        <StatCard
          label="Açık Alacak"
          value={formatTRY(analytics.totalReceivable)}
          icon={Receipt}
          accent="text-red-600"
          accentBg="bg-red-100"
          subtitle={`${analytics.completedOrders} tamamlanan sipariş`}
        />
        <StatCard
          label="Ort. İş Emri Tutarı"
          value={analytics.averageTicketSize > 0 ? formatTRY(analytics.averageTicketSize) : "—"}
          icon={BarChart3}
          accent="text-blue-600"
          accentBg="bg-blue-100"
          subtitle="Tamamlanan siparişler"
        />
        <StatCard
          label="İş Emri Başı Gelir"
          value={analytics.revenuePerWorkOrder > 0 ? formatTRY(analytics.revenuePerWorkOrder) : "—"}
          icon={TrendingUp}
          accent="text-purple-600"
          accentBg="bg-purple-100"
          subtitle={`${analytics.totalOrders} toplam sipariş`}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">Tahsilat Trendi (Son 6 Ay)</h3>
        </div>
        <div className="p-4 sm:p-6">
          {analytics.collectionTrend.every((m) => m.amount === 0) ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Henüz tahsilat verisi bulunmuyor.
            </div>
          ) : (
            <div className="flex items-end gap-2 sm:gap-4 h-48">
              {analytics.collectionTrend.map((m) => {
                const height = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      {m.amount > 0 ? formatTRY(m.amount) : "—"}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 transition-all"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 mt-1">{m.label}</span>
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