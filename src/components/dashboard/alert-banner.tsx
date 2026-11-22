import Link from "next/link"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { AlertTriangle, Camera, MessageCircle, Check, ChevronRight } from "lucide-react"
import { DashPanel, DashTile, surface, type Tone } from "@/components/dashboard/surface"

interface AlertItem {
  title: string
  sub: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
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
      title: `${stats.overdueDeliveries} araç kabulünün teslimi gecikti`,
      sub: "Tahmini teslim tarihi geçti",
      href: "/orders?status=active",
      icon: AlertTriangle,
      tone: "destructive",
    })
  }

  if (showPhotoChecklist && stats.missingPhotoIntakes > 0) {
    alerts.push({
      title: `${stats.missingPhotoIntakes} kabulde fotoğraf eksik`,
      sub: "Zorunlu kabul fotoğrafları tamamlanmadı",
      href: "/orders",
      icon: Camera,
      tone: "destructive",
    })
  }

  if (showQuotes && stats.waitingApprovals > 0) {
    alerts.push({
      title: `${stats.waitingApprovals} araç kabulü müşteri onayı bekliyor`,
      sub: "Onay gelince işe başlanabilir",
      href: "/orders?status=waiting_approval",
      icon: MessageCircle,
      tone: "warning",
    })
  }

  return (
    <DashPanel title="Dikkat gerektiren işler" bare>
      <div className={surface.notes}>
        {alerts.length === 0 ? (
          <div className={surface.note}>
            <DashTile tone="success" circle><Check /></DashTile>
            <span className={surface.rowMain}>
              <span className={surface.rowTitle}>Her şey yolunda</span>
              <span className={surface.rowSub}>Bugün kritik operasyon uyarısı yok</span>
            </span>
          </div>
        ) : alerts.map((alert) => {
          const Icon = alert.icon
          return (
            <Link key={alert.title} href={alert.href} prefetch={false} className={surface.note}>
              <DashTile tone={alert.tone}><Icon /></DashTile>
              <span className={surface.rowMain}>
                <span className={surface.rowTitle}>{alert.title}</span>
                <span className={surface.rowSub}>{alert.sub}</span>
              </span>
              <ChevronRight aria-hidden className={surface.chevron} />
            </Link>
          )
        })}
      </div>
    </DashPanel>
  )
}
