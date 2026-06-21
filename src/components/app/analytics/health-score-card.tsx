import Link from "next/link"
import type { OperationsHealth } from "@/lib/analytics/queries"
import { Wrench, Clock, MessageCircle, AlertTriangle, Wallet } from "lucide-react"

function scoreRingColor(score: number): string {
  if (score >= 80) return "stroke-success"
  if (score >= 50) return "stroke-warning"
  return "stroke-destructive"
}

function scoreLabel(score: number): string {
  if (score >= 80) return "İyi"
  if (score >= 50) return "Orta"
  return "Kritik"
}

export function HealthScoreCard({ health }: { health: OperationsHealth }) {
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (health.healthScore / 100) * circumference

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg className="size-32 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-border" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              className={scoreRingColor(health.healthScore)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">
              {health.healthScore}
            </span>
            <span className="text-xs text-muted-foreground">{scoreLabel(health.healthScore)}</span>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground">Operasyon Sağlık Skoru</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Geciken iş emirleri, kritik stok ve ödenmemiş iş emirleri baz alınarak hesaplanır.
          </p>
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            health.healthScore >= 80
              ? "bg-success/10 text-foreground"
              : health.healthScore >= 50
                ? "bg-warning/10 text-foreground"
                : "bg-destructive/10 text-foreground"
          }`}>
            <div className={`size-2 rounded-full ${
              health.healthScore >= 80
                ? "bg-success"
                : health.healthScore >= 50
                  ? "bg-warning"
                  : "bg-destructive"
            }`} />
            {scoreLabel(health.healthScore)} Durum
          </div>
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  href: string
  accent: string
  accentBg: string
  subtitle?: string
}

function MetricCard({ label, value, icon: Icon, href, accent, accentBg, subtitle }: MetricCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 hover:shadow-sm hover:border-border transition-all group"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`size-8 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </Link>
  )
}

export function HealthMetricCards({ health }: { health: OperationsHealth }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <MetricCard
        label="Aktif İş Emri"
        value={health.activeJobs}
        icon={Wrench}
        href="/app/orders"
        accent="text-primary"
        accentBg="bg-primary/10"
      />
      <MetricCard
        label="Geciken İş Emri"
        value={health.delayedJobs}
        icon={Clock}
        href="/app/analytics"
        accent="text-destructive"
        accentBg="bg-destructive/10"
        subtitle={health.delayedJobs > 0 ? "Teslim tarihi geçti" : undefined}
      />
      <MetricCard
        label="Onay Bekleyen"
        value={health.waitingApprovals}
        icon={MessageCircle}
        href="/app/orders?status=waiting_approval"
        accent="text-warning"
        accentBg="bg-warning/10"
      />
      <MetricCard
        label="Kritik Stok"
        value={health.criticalStock}
        icon={AlertTriangle}
        href="/app/parts"
        accent="text-warning"
        accentBg="bg-warning/10"
      />
      <MetricCard
        label="Açık Alacak"
        value={health.unpaidWorkOrders}
        icon={Wallet}
        href="/app/reports/collections"
        accent="text-destructive"
        accentBg="bg-destructive/10"
        subtitle={health.openReceivables > 0 ? "Ödenmemiş iş emri" : undefined}
      />
    </div>
  )
}