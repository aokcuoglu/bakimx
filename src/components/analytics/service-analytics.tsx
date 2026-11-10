import type { ServiceAnalytics as ServiceAnalyticsType } from "@/lib/analytics/queries"
import { formatTRY } from "@/lib/format"
import { MessageSquare, Wrench, HardHat } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

type ServiceItem = { name: string; count: number; detail?: string; revenue?: number }

function TopList({ title, nameLabel, icon: Icon, items, showRevenue = false }: {
  title: string
  nameLabel: string
  icon: React.ComponentType<{ className?: string }>
  items: ServiceItem[]
  showRevenue?: boolean
}) {
  return (
    <Card className="min-w-0 gap-0 py-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <Table aria-label={title} className="table-fixed" containerClassName="min-w-0">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4 text-xs text-muted-foreground">{nameLabel}</TableHead>
            <TableHead className="w-16 px-3 text-right text-xs text-muted-foreground">Adet</TableHead>
            {showRevenue && <TableHead className="w-32 px-4 text-right text-xs text-muted-foreground">Gelir</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showRevenue ? 3 : 2} className="px-4 py-6 text-center text-muted-foreground">Veri bulunmuyor.</TableCell>
            </TableRow>
          ) : items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="px-4 py-2 whitespace-normal wrap-anywhere">
                <span className="font-medium">{item.name}</span>
                {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums whitespace-normal wrap-anywhere">{item.count}</TableCell>
              {showRevenue && <TableCell className="px-4 py-2 text-right tabular-nums whitespace-normal wrap-anywhere">{formatTRY(item.revenue ?? 0)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

export function ServiceAnalyticsSection({ analytics }: { analytics: ServiceAnalyticsType }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <TopList title="En Sık Şikayetler" nameLabel="Şikayet" icon={MessageSquare}
        items={analytics.topComplaints.map((c) => ({ name: c.complaint, count: c.count }))} />
      <TopList title="En Sık Onarımlar" nameLabel="Onarım" icon={Wrench}
        items={analytics.topRepairs.map((r) => ({
          name: r.itemName, count: r.count,
          detail: r.type === "part" ? "Parça" : r.type === "external_labor" ? "Dış İşçilik" : "İşçilik",
        }))} />
      <div className="min-w-0 xl:col-span-2">
        <TopList title="En Çok Yapılan İşçilikler" nameLabel="İşçilik" icon={HardHat} showRevenue
          items={analytics.topLaborItems.map((l) => ({ name: l.laborName, count: l.count, revenue: l.totalRevenue }))} />
      </div>
    </div>
  )
}
