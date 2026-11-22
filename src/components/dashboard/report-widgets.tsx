import styles from "./summary-cards.module.css"
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
    <div className={styles.summary} aria-label="Aylık rapor özeti">
      <div className={styles.reports}>
        <HighlightCard className={styles.card} label="Aylık Ciro" value={formatTRY(data.monthlyRevenue)} href="/reports/collections" accessory={<TrendingUp aria-hidden />} description="Bu ay tahsil edilen toplam" />
        <HighlightCard className={styles.card} label="Bu Ay Araç Kabul" value={data.workOrdersThisMonth} href="/reports/orders" accessory={<Wrench aria-hidden />} description="Bu ay oluşturulan araç kabulü" />
        <HighlightCard className={styles.card} label="Bu Ay Tahsilat" value={data.collectionsThisMonth} href="/reports/collections" accessory={<Wallet aria-hidden />} description="Bu ayki tahsilat sayısı" />
      </div>
    </div>
  )
}
