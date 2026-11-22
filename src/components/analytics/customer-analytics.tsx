import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { HighlightCard } from "@/components/shared/highlight-card"
import type { CustomerAnalytics as CustomerAnalyticsType } from "@/lib/analytics/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Users, UserPlus, UserCheck, UserX, TrendingUp } from "lucide-react"

function StatCard({ label, value, subtitle, icon: Icon }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return <HighlightCard label={label} value={value} accessory={<Icon />} description={subtitle} />
}

export function CustomerAnalyticsSection({ analytics }: { analytics: CustomerAnalyticsType }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Müşteri"
          value={analytics.totalCustomers}
          icon={Users}
        />
        <StatCard
          label="Bu Ay Yeni"
          value={analytics.newThisMonth}
          icon={UserPlus}
        />
        <StatCard
          label="Geri Dönüş Oranı"
          value={`%${analytics.repeatCustomerRate}`}
          subtitle={analytics.repeatCustomerRate >= 40 ? "İyi seviye" : analytics.repeatCustomerRate < 20 ? "Düşük" : "Orta"}
          icon={UserCheck}
        />
        <StatCard
          label="Pasif Müşteri"
          value={analytics.inactiveCustomers}
          subtitle="90+ gün aktif değil"
          icon={UserX}
        />
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp className="size-4 text-success-strong" />
          <h3 className="text-sm font-medium text-foreground">En Yüksek Değerli Müşteriler</h3>
        </div>
        {analytics.highValueCustomers.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Henüz siparişi olan müşteri bulunmuyor.
          </div>
        ) : (
          <div className="min-w-0">
            <Table aria-label="En Yüksek Değerli Müşteriler">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-4 text-xs text-muted-foreground">#</TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">Müşteri</TableHead>
                  <TableHead className="px-4 text-xs text-muted-foreground">Telefon</TableHead>
                  <TableHead className="px-4 text-right text-xs text-muted-foreground">Araç Kabul</TableHead>
                  <TableHead className="px-4 text-right text-xs text-muted-foreground">Toplam Harcama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.highValueCustomers.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="px-4 py-2">
                      <span className="inline-flex text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Link href={`/customers/${c.id}`} className="block max-w-80 whitespace-normal wrap-anywhere font-medium text-foreground hover:underline focus-visible:outline-ring">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="px-4 py-2 text-right tabular-nums text-foreground">{c.orderCount}</TableCell>
                    <TableCell className="px-4 py-2 text-right font-medium tabular-nums text-foreground">{formatTRY(c.totalSpent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}