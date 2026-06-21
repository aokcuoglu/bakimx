import type { PartsAnalytics as PartsAnalyticsType } from "@/lib/analytics/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Boxes, AlertTriangle, PackageX, TrendingUp, BarChart3 } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon, accent, accentBg }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`size-8 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function PartsAnalyticsSection({ analytics }: { analytics: PartsAnalyticsType }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Parça"
          value={analytics.totalParts}
          icon={Boxes}
          accent="text-primary"
          accentBg="bg-primary/10"
        />
        <StatCard
          label="Stok Değeri"
          value={formatTRY(analytics.stockValue)}
          icon={BarChart3}
          accent="text-success"
          accentBg="bg-success/10"
        />
        <StatCard
          label="Kritik Stok"
          value={analytics.criticalStockCount}
          icon={AlertTriangle}
          accent="text-warning"
          accentBg="bg-warning/10"
          subtitle="Kritik seviyede"
        />
        <StatCard
          label="Tükenen Stok"
          value={analytics.outOfStockCount}
          icon={PackageX}
          accent="text-destructive"
          accentBg="bg-destructive/10"
          subtitle="Stokta yok"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">En Çok Tüketilen Parçalar</h3>
          </div>
          {analytics.mostConsumed.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Henüz stok çıkışı yapılmamış.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {analytics.mostConsumed.map((part, i) => (
                <div key={part.partId} className="flex items-center justify-between px-4 sm:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className="size-6 rounded-full bg-primary/10 text-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{part.name}</p>
                      <p className="text-xs text-muted-foreground">{part.sku || "—"}{part.category ? ` · ${part.category}` : ""}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{part.totalUsed} adet</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="text-base font-semibold text-foreground">Stok Risk Listesi</h3>
          </div>
          {analytics.stockRiskList.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Kritik stok seviyesinde parça yok.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Parça</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Stok</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Kritik</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.stockRiskList.slice(0, 10).map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-2">
                        <Link href={`/app/parts/${item.id}`} className="font-medium text-primary hover:underline">
                          {item.name}
                        </Link>
                        {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={item.stockQty <= 0 ? "text-destructive font-semibold" : "text-warning font-semibold"}>
                          {item.stockQty}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{item.criticalStockQty}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === "out_of_stock"
                            ? "bg-destructive/10 text-foreground"
                            : "bg-warning/10 text-foreground"
                        }`}>
                          {item.status === "out_of_stock" ? "Tükendi" : "Kritik"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}