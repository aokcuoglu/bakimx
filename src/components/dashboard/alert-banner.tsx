import Link from "next/link"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { AlertTriangle, Camera, MessageCircle, CheckCircle2 } from "lucide-react"

interface AlertItem {
  count: number
  message: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

export function AlertBanner({
  stats,
  showQuotes,
  showPhotoChecklist,
}: {
  stats: DashboardStats
  showQuotes: boolean
  showPhotoChecklist: boolean
}) {
  const alerts: AlertItem[] = []

  if (stats.overdueDeliveries > 0) {
    alerts.push({
      count: stats.overdueDeliveries,
      message: `${stats.overdueDeliveries} iş emri tahmini teslim tarihini geçti.`,
      href: "/orders?status=active",
      icon: AlertTriangle,
      color: "red",
    })
  }

  if (showPhotoChecklist && stats.missingPhotoIntakes > 0) {
    alerts.push({
      count: stats.missingPhotoIntakes,
      message: `${stats.missingPhotoIntakes} araç kabulünde zorunlu fotoğraflar eksik.`,
      href: "/orders",
      icon: Camera,
      color: "rose",
    })
  }

  if (showQuotes && stats.waitingApprovals > 0) {
    alerts.push({
      count: stats.waitingApprovals,
      message: `${stats.waitingApprovals} müşteri onayı bekleyen iş emri var.`,
      href: "/orders?status=waiting_approval",
      icon: MessageCircle,
      color: "amber",
    })
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <CheckCircle2 className="size-4 text-success-strong shrink-0" />
        <p className="text-sm text-foreground">Bugün kritik operasyon uyarısı bulunmuyor.</p>
      </div>
    )
  }

  const colorMap = {
    red: {
      icon: "text-destructive-strong",
    },
    rose: {
      icon: "text-destructive-strong",
    },
    amber: {
      icon: "text-warning-strong",
    },
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const colors = colorMap[alert.color as keyof typeof colorMap] || colorMap.amber
        const Icon = alert.icon
        return (
          <Link
            key={i}
            href={alert.href}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={`shrink-0 ${colors.icon}`}>
              <Icon className="size-4" />
            </div>
            <p className="flex-1 text-sm font-medium text-foreground">{alert.message}</p>
          </Link>
        )
      })}
    </div>
  )
}
