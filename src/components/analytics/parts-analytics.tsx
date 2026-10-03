import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { HighlightCard } from "@/components/shared/highlight-card"
import type { PartsAnalytics as PartsAnalyticsType } from "@/lib/analytics/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Boxes, AlertTriangle, PackageX, TrendingUp, BarChart3 } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return <HighlightCard label={label} value={value} accessory={<Icon />} description={subtitle} />
}

export function PartsAnalyticsSection({ analytics }: { analytics: PartsAnalyticsType }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Parça"
          value={analytics.totalParts}
          icon={Boxes}
        />
        <StatCard
          label="Stok Değeri"
          value={formatTRY(analytics.stockValue)}
          icon={BarChart3}
        />
        <StatCard
          label="Kritik Stok"
          value={analytics.criticalStockCount}
          icon={AlertTriangle}
          subtitle="Kritik seviyede"
        />
        <StatCard
          label="Tükenen Stok"
          value={analytics.outOfStockCount}
          icon={PackageX}
          subtitle="Stokta yok"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">En Çok Tüketilen Parçalar</h3>
          </div>
          {analytics.mostConsumed.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Henüz stok çıkışı yapılmamış.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {analytics.mostConsumed.map((part, i) => (
                <div key={part.partId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 wrap-anywhere">
                      <p className="text-sm font-medium text-foreground">{part.name}</p>
                      <p className="text-xs text-muted-foreground">{part.sku || "—"}{part.category ? ` · ${part.category}` : ""}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{part.totalUsed} adet</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive-strong" />
            <h3 className="text-sm font-medium text-foreground">Stok Risk Listesi</h3>
          </div>
          {analytics.stockRiskList.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Kritik stok seviyesinde parça yok.
            </div>
          ) : (
            <div className="min-w-0">
              <Table aria-label="Stok Risk Listesi">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="px-4 text-xs text-muted-foreground">Parça</TableHead>
                    <TableHead className="px-4 text-right text-xs text-muted-foreground">Stok</TableHead>
                    <TableHead className="px-4 text-right text-xs text-muted-foreground">Kritik</TableHead>
                    <TableHead className="px-4 text-right text-xs text-muted-foreground">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.stockRiskList.slice(0, 10).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-4 py-2">
                        <Link href={`/parts/${item.id}`} className="font-medium text-primary hover:underline">
                          {item.name}
                        </Link>
                        {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">
                        <span className={item.stockQty <= 0 ? "text-destructive-strong font-semibold" : "text-warning-strong font-semibold"}>
                          {item.stockQty}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums text-muted-foreground">{item.criticalStockQty}</TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === "out_of_stock"
                            ? "bg-destructive/10 text-foreground"
                            : "bg-warning/10 text-foreground"
                        }`}>
                          {item.status === "out_of_stock" ? "Tükendi" : "Kritik"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}