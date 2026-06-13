import type { CustomerAnalytics as CustomerAnalyticsType } from "@/lib/analytics/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Users, UserPlus, UserCheck, UserX, TrendingUp } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon, accent }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function CustomerAnalyticsSection({ analytics }: { analytics: CustomerAnalyticsType }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Müşteri"
          value={analytics.totalCustomers}
          icon={Users}
          accent="text-blue-600"
        />
        <StatCard
          label="Bu Ay Yeni"
          value={analytics.newThisMonth}
          icon={UserPlus}
          accent="text-emerald-600"
        />
        <StatCard
          label="Geri Dönüş Oranı"
          value={`%${analytics.repeatCustomerRate}`}
          subtitle={analytics.repeatCustomerRate >= 40 ? "İyi seviye" : analytics.repeatCustomerRate < 20 ? "Düşük" : "Orta"}
          icon={UserCheck}
          accent="text-purple-600"
        />
        <StatCard
          label="Pasif Müşteri"
          value={analytics.inactiveCustomers}
          subtitle="90+ gün aktif değil"
          icon={UserX}
          accent="text-amber-600"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">En Yüksek Değerli Müşteriler</h3>
        </div>
        {analytics.highValueCustomers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Henüz siparişi olan müşteri bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500">Müşteri</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 hidden sm:table-cell">Telefon</th>
                  <th className="text-center px-4 py-2.5 font-medium text-slate-500">İş Emri</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500">Toplam Harcama</th>
                </tr>
              </thead>
              <tbody>
                {analytics.highValueCustomers.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <span className="size-6 rounded-full bg-emerald-50 text-emerald-600 inline-flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/app/customers/${c.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{c.phone}</td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{c.orderCount}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatTRY(c.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}