import { HighlightCard } from "@/components/shared/highlight-card"
import { TrendingUp, Wrench, Wallet } from "lucide-react"
import { formatTRY } from "@/lib/format"

export type DashboardReportWidgetData = {
  monthlyRevenue: number
  workOrdersThisMonth: number
  collectionsThisMonth: number
}

export function DashboardReportWidgets({ data }: { data: DashboardReportWidgetData }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <HighlightCard label="Aylık Ciro" value={formatTRY(data.monthlyRevenue)} href="/reports/collections" accessory={<TrendingUp aria-hidden />} description="Bu ay tahsil edilen toplam" />
      <HighlightCard label="Bu Ay İş Emri" value={data.workOrdersThisMonth} href="/reports/orders" accessory={<Wrench aria-hidden />} description="Bu ay oluşturulan iş emri" />
      <HighlightCard label="Bu Ay Tahsilat" value={data.collectionsThisMonth} href="/reports/collections" accessory={<Wallet aria-hidden />} description="Bu ayki tahsilat sayısı" />
    </div>
  )
}
