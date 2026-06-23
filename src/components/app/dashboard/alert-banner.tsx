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

export function AlertBanner({ stats }: { stats: DashboardStats }) {
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

  if (stats.missingPhotoIntakes > 0) {
    alerts.push({
      count: stats.missingPhotoIntakes,
      message: `${stats.missingPhotoIntakes} araç kabulünde zorunlu fotoğraflar eksik.`,
      href: "/intakes",
      icon: Camera,
      color: "rose",
    })
  }

  if (stats.waitingApprovals > 0) {
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
      <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
        <CheckCircle2 className="size-4 text-success shrink-0" />
        <p className="text-sm text-foreground">Bugün kritik operasyon uyarısı bulunmuyor.</p>
      </div>
    )
  }

  const colorMap = {
    red: {
      bg: "bg-destructive/10 border-destructive/20",
      text: "text-foreground",
      icon: "text-destructive",
      hover: "hover:bg-destructive/20",
    },
    rose: {
      bg: "bg-destructive/10 border-destructive/20",
      text: "text-foreground",
      icon: "text-destructive",
      hover: "hover:bg-destructive/20",
    },
    amber: {
      bg: "bg-warning/10 border-warning/20",
      text: "text-foreground",
      icon: "text-warning",
      hover: "hover:bg-warning/20",
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
            className={`flex items-center gap-3 rounded-lg border ${colors.bg} ${colors.hover} px-4 py-3 transition-colors group`}
          >
            <div className={`shrink-0 ${colors.icon}`}>
              <Icon className="size-4" />
            </div>
            <p className={`text-sm font-medium ${colors.text} flex-1`}>{alert.message}</p>
          </Link>
        )
      })}
    </div>
  )
}
