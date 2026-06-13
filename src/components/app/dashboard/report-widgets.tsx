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
        href="/app/reports/collections"
        className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-500">Aylık Ciro</span>
          <div className="size-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-emerald-700">{formatTRY(data.monthlyRevenue)}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Bu ay tahsil edilen toplam</p>
      </Link>

      <Link
        href="/app/reports/orders"
        className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-500">Bu Ay İş Emri</span>
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Wrench className="size-4 text-blue-600" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-blue-700">{data.workOrdersThisMonth}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Bu ay oluşturulan iş emri</p>
      </Link>

      <Link
        href="/app/reports/collections"
        className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-500">Bu Ay Tahsilat</span>
          <div className="size-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <Wallet className="size-4 text-purple-600" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-purple-700">{data.collectionsThisMonth}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Bu ayki tahsilat sayısı</p>
      </Link>
    </div>
  )
}