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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Link
        href="/reports/collections"
        className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <div className="mb-5 flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Aylık Ciro</span>
          <TrendingUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[28px]">{formatTRY(data.monthlyRevenue)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bu ay tahsil edilen toplam</p>
      </Link>

      <Link
        href="/reports/orders"
        className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <div className="mb-5 flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Bu Ay İş Emri</span>
          <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[28px]">{data.workOrdersThisMonth}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bu ay oluşturulan iş emri</p>
      </Link>

      <Link
        href="/reports/collections"
        className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      >
        <div className="mb-5 flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Bu Ay Tahsilat</span>
          <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[28px]">{data.collectionsThisMonth}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bu ayki tahsilat sayısı</p>
      </Link>
    </div>
  )
}
