import { formatTRY } from "@/lib/format"
import { DashStat, DashStatGrid } from "@/components/dashboard/surface"

export type DashboardReportWidgetData = {
  monthlyRevenue: number
  workOrdersThisMonth: number
  collectionsThisMonth: number
}

export function DashboardReportWidgets({ data }: { data: DashboardReportWidgetData }) {
  return (
    <DashStatGrid label="Aylık rapor özeti" count={3}>
      <DashStat label="Bu ay ciro" value={formatTRY(data.monthlyRevenue)} href="/reports/collections" />
      <DashStat label="Bu ay araç kabulü" value={data.workOrdersThisMonth} href="/reports/orders" />
      <DashStat label="Bu ay tahsilat" value={data.collectionsThisMonth} href="/reports/collections" />
    </DashStatGrid>
  )
}
