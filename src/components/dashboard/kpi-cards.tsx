import styles from "./summary-cards.module.css"
import { HighlightCard } from "@/components/shared/highlight-card"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { Wrench, Clock, MessageCircle, Camera, AlertTriangle, Calendar } from "lucide-react"

interface KpiCardProps {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  tone?: "warning" | "destructive"
  subtitle?: string
}

function KpiCard({ label, value, icon: Icon, href, tone, subtitle }: KpiCardProps) {
  const iconTone = value > 0 && tone === "warning"
    ? "text-warning-strong"
    : value > 0 && tone === "destructive"
      ? "text-destructive-strong"
      : "text-muted-foreground"

  return (
    <HighlightCard
      className={styles.card}
      label={label}
      value={value}
      href={href}
      accessory={<Icon className={iconTone} aria-hidden />}
      description={subtitle}
    />
  )
}

export function KpiCards({
  stats,
  showQuotes,
  showPhotoChecklist,
}: {
  stats: DashboardStats
  showQuotes: boolean
  showPhotoChecklist: boolean
}) {
  return (
    <div className={styles.summary} aria-label="Operasyon özeti">
      <div className={styles.kpis}>
        <KpiCard
          label="Aktif İş Emri"
          value={stats.activeOrders}
          icon={Wrench}
          href="/orders"
        />
        <KpiCard
          label="Bugün Teslim"
          value={stats.todayDeliveries}
          icon={Clock}
          href="/orders"
        />
        {showQuotes && (
          <KpiCard
            label="Onay Bekleyen"
            value={stats.waitingApprovals}
            icon={MessageCircle}
            href="/orders?status=waiting_approval"
            tone="warning"
          />
        )}
        {showPhotoChecklist && (
          <KpiCard
            label="Eksik Fotoğraf"
            value={stats.missingPhotoIntakes}
            icon={Camera}
            href="/orders"
            tone="destructive"
          />
        )}
        <KpiCard
          label="Geciken Teslim"
          value={stats.overdueDeliveries}
          icon={AlertTriangle}
          href="/orders"
          tone="destructive"
        />
        <KpiCard
          label="Son 7 Gün"
          value={stats.lastWeekOrders}
          icon={Calendar}
          href="/orders"
        />
      </div>
    </div>
  )
}
