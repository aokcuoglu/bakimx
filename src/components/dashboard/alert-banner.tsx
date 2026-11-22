import Link from "next/link"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
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
      message: `${stats.overdueDeliveries} araç kabul tahmini teslim tarihini geçti.`,
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
      message: `${stats.waitingApprovals} müşteri onayı bekleyen araç kabulü var.`,
      href: "/orders?status=waiting_approval",
      icon: MessageCircle,
      color: "amber",
    })
  }

  return (
    <section aria-label="Dikkat gerektiren işler" className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Dikkat Gerektiren İşler</h3>
      {alerts.length === 0 ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden className="size-4" />
          <AlertTitle>Bugün kritik operasyon uyarısı bulunmuyor.</AlertTitle>
        </Alert>
      ) : alerts.map((alert) => {
        const Icon = alert.icon
        return (
          <Alert key={alert.href} variant={alert.color === "amber" ? "warning" : "destructive"}>
            <Icon aria-hidden className="size-4" />
            <AlertTitle>{alert.message}</AlertTitle>
            <AlertDescription>
              <Link href={alert.href} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Araç kabullerini incele →</Link>
            </AlertDescription>
          </Alert>
        )
      })}
    </section>
  )
}
