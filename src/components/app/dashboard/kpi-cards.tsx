import Link from "next/link"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { Wrench, Clock, MessageCircle, Camera, AlertTriangle, Calendar } from "lucide-react"

interface KpiCardProps {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  accent: string
  accentBg: string
  subtitle?: string
}

function KpiCard({ label, value, icon: Icon, href, accent, accentBg, subtitle }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 hover:shadow-sm hover:border-border transition-all group"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`size-9 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-4 ${accent}`} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </Link>
  )
}

export function KpiCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        label="Aktif İş Emri"
        value={stats.activeOrders}
        icon={Wrench}
        href="/app/orders"
        accent="text-primary"
        accentBg="bg-primary/10"
      />
      <KpiCard
        label="Bugün Teslim"
        value={stats.todayDeliveries}
        icon={Clock}
        href="/app/orders"
        accent="text-success"
        accentBg="bg-success/10"
      />
      <KpiCard
        label="Onay Bekleyen"
        value={stats.waitingApprovals}
        icon={MessageCircle}
        href="/app/orders?status=waiting_approval"
        accent="text-warning"
        accentBg="bg-warning/10"
      />
      <KpiCard
        label="Eksik Fotoğraf"
        value={stats.missingPhotoIntakes}
        icon={Camera}
        href="/app/intakes"
        accent="text-destructive"
        accentBg="bg-destructive/10"
      />
      <KpiCard
        label="Geciken Teslim"
        value={stats.overdueDeliveries}
        icon={AlertTriangle}
        href="/app/orders"
        accent="text-destructive"
        accentBg="bg-destructive/10"
      />
      <KpiCard
        label="Son 7 Gün"
        value={stats.lastWeekOrders}
        icon={Calendar}
        href="/app/orders"
        accent="text-primary"
        accentBg="bg-primary/10"
      />
    </div>
  )
}
