import Link from "next/link"
import { TrendingUp, Wrench, Wallet } from "lucide-react"
import { formatTRY } from "@/lib/format"

export type DashboardReportWidgetData = {
  monthlyRevenue: number
  workOrdersThisMonth: number
  collectionsThisMonth: number
}

export function DashboardReportWidgets({ data }: { data: DashboardReportWidgetData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Link
        href="/reports/collections"
        className="rounded-lg border border-border bg-card p-4 hover:shadow-sm hover:border-border transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Aylık Ciro</span>
          <div className="size-9 rounded-lg bg-success/10 flex items-center justify-center">
            <TrendingUp className="size-4 text-success" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-success">{formatTRY(data.monthlyRevenue)}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bu ay tahsil edilen toplam</p>
      </Link>

      <Link
        href="/reports/orders"
        className="rounded-lg border border-border bg-card p-4 hover:shadow-sm hover:border-border transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Bu Ay İş Emri</span>
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wrench className="size-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-primary">{data.workOrdersThisMonth}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bu ay oluşturulan iş emri</p>
      </Link>

      <Link
        href="/reports/collections"
        className="rounded-lg border border-border bg-card p-4 hover:shadow-sm hover:border-border transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Bu Ay Tahsilat</span>
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="size-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-primary">{data.collectionsThisMonth}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Bu ayki tahsilat sayısı</p>
      </Link>
    </div>
  )
}