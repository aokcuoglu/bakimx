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
      href: "/app/orders?status=active",
      icon: AlertTriangle,
      color: "red",
    })
  }

  if (stats.missingPhotoIntakes > 0) {
    alerts.push({
      count: stats.missingPhotoIntakes,
      message: `${stats.missingPhotoIntakes} araç kabulünde zorunlu fotoğraflar eksik.`,
      href: "/app/intakes",
      icon: Camera,
      color: "rose",
    })
  }

  if (stats.waitingApprovals > 0) {
    alerts.push({
      count: stats.waitingApprovals,
      message: `${stats.waitingApprovals} müşteri onayı bekleyen iş emri var.`,
      href: "/app/orders?status=waiting_approval",
      icon: MessageCircle,
      color: "amber",
    })
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700">Bugün kritik operasyon uyarısı bulunmuyor.</p>
      </div>
    )
  }

  const colorMap = {
    red: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-800",
      icon: "text-red-500",
      hover: "hover:bg-red-100/60",
    },
    rose: {
      bg: "bg-rose-50 border-rose-200",
      text: "text-rose-800",
      icon: "text-rose-500",
      hover: "hover:bg-rose-100/60",
    },
    amber: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      icon: "text-amber-500",
      hover: "hover:bg-amber-100/60",
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
            className={`flex items-center gap-3 rounded-xl border ${colors.bg} ${colors.hover} px-4 py-3 transition-colors group`}
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
