import Link from "next/link"
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
    <Link
      href={href}
      className="group min-w-0 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={`size-4 shrink-0 ${iconTone}`} aria-hidden />
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[28px]">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </Link>
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
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
  )
}
