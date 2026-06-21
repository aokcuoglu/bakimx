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
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
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
          accent="text-primary"
        />
        <StatCard
          label="Bu Ay Yeni"
          value={analytics.newThisMonth}
          icon={UserPlus}
          accent="text-success"
        />
        <StatCard
          label="Geri Dönüş Oranı"
          value={`%${analytics.repeatCustomerRate}`}
          subtitle={analytics.repeatCustomerRate >= 40 ? "İyi seviye" : analytics.repeatCustomerRate < 20 ? "Düşük" : "Orta"}
          icon={UserCheck}
          accent="text-primary"
        />
        <StatCard
          label="Pasif Müşteri"
          value={analytics.inactiveCustomers}
          subtitle="90+ gün aktif değil"
          icon={UserX}
          accent="text-warning"
        />
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="size-4 text-success" />
          <h3 className="text-base font-semibold text-foreground">En Yüksek Değerli Müşteriler</h3>
        </div>
        {analytics.highValueCustomers.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Henüz siparişi olan müşteri bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Müşteri</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Telefon</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">İş Emri</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Toplam Harcama</th>
                </tr>
              </thead>
              <tbody>
                {analytics.highValueCustomers.map((c, i) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <span className="size-6 rounded-full bg-success/10 text-success inline-flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/app/customers/${c.id}`} className="font-medium text-primary hover:text-primary/80">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{c.phone}</td>
                    <td className="px-4 py-2.5 text-center text-foreground">{c.orderCount}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">{formatTRY(c.totalSpent)}</td>
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