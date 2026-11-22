import { HighlightCard } from "@/components/shared/highlight-card"
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
    <div className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative size-20 shrink-0">
          <svg className="size-20 -rotate-90" viewBox="0 0 100 100">
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
            <span className="text-xl font-semibold text-foreground">
              {health.healthScore}
            </span>
            <span className="text-xs text-muted-foreground">{scoreLabel(health.healthScore)}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h3 className="text-sm font-medium text-foreground">Operasyon Sağlık Skoru</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Geciken araç kabulleri, kritik stok ve ödenmemiş araç kabulleri baz alınarak hesaplanır.
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
  subtitle?: string
}

function MetricCard({ label, value, icon: Icon, href, subtitle }: MetricCardProps) {
  return <HighlightCard label={label} value={value} accessory={<Icon />} description={subtitle} href={href} />
}

export function HealthMetricCards({ health }: { health: OperationsHealth }) {
  return (
    <div className="grid grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <MetricCard
        label="Aktif Araç Kabul"
        value={health.activeJobs}
        icon={Wrench}
        href="/orders"
      />
      <MetricCard
        label="Geciken Araç Kabul"
        value={health.delayedJobs}
        icon={Clock}
        href="/analytics"
        subtitle={health.delayedJobs > 0 ? "Teslim tarihi geçti" : undefined}
      />
      <MetricCard
        label="Onay Bekleyen"
        value={health.waitingApprovals}
        icon={MessageCircle}
        href="/orders?status=waiting_approval"
      />
      <MetricCard
        label="Kritik Stok"
        value={health.criticalStock}
        icon={AlertTriangle}
        href="/parts"
      />
      <MetricCard
        label="Açık Alacak"
        value={health.unpaidWorkOrders}
        icon={Wallet}
        href="/reports/collections"
        subtitle={health.openReceivables > 0 ? "Ödenmemiş araç kabulü" : undefined}
      />
    </div>
  )
}