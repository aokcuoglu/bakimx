import Link from "next/link"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { AlertTriangle, Bell, Camera, MessageCircle, Check, ChevronRight, Package, UserRoundX } from "lucide-react"
import { DashPanel, DashTile, surface, type Tone } from "@/components/dashboard/surface"
import { DELIVERY_OVERDUE } from "@/lib/orders/delivery-filter"
import { UNASSIGNED_IN_SERVICE_HREF } from "@/lib/orders/unassigned-in-service"

interface AlertItem {
  title: string
  sub: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}

/**
 * Yöneticinin müdahale etmesi gereken her şey tek listede, sayı olarak. Ayrıntı
 * listeleri Genel Bakış'ta tekrarlanmaz; her satır kendi filtreli sayfasını açar.
 * Pakette olmayan özelliğin satırı hiç üretilmez (ilgili sayı `null` gelir).
 */
export function AlertBanner({
  stats,
  showQuotes,
  showPhotoChecklist,
  unassignedCount,
  stock,
  overdueReminders,
}: {
  stats: DashboardStats
  showQuotes: boolean
  showPhotoChecklist: boolean
  /** Ustası olmayan serviste iş; ekip özelliği yoksa null. */
  unassignedCount: number | null
  /** Stok özelliği yoksa null. */
  stock: { outOfStock: number; critical: number } | null
  /** Hatırlatma özelliği yoksa null. */
  overdueReminders: number | null
}) {
  const alerts: AlertItem[] = []

  if (stats.overdueDeliveries > 0) {
    alerts.push({
      title: `${stats.overdueDeliveries} araç kabulünün teslimi gecikti`,
      sub: "Tahmini teslim tarihi geçti",
      href: `/orders?delivery=${DELIVERY_OVERDUE}`,
      icon: AlertTriangle,
      tone: "destructive",
    })
  }

  if (unassignedCount != null && unassignedCount > 0) {
    alerts.push({
      title: `${unassignedCount} araç kabulü usta bekliyor`,
      sub: "Serviste ama henüz kimseye atanmadı",
      href: UNASSIGNED_IN_SERVICE_HREF,
      icon: UserRoundX,
      tone: "warning",
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

  if (showPhotoChecklist && stats.missingPhotoIntakes > 0) {
    alerts.push({
      title: `${stats.missingPhotoIntakes} kabulde fotoğraf eksik`,
      sub: "Zorunlu kabul fotoğrafları tamamlanmadı",
      href: "/orders",
      icon: Camera,
      tone: "destructive",
    })
  }

  if (stock && stock.outOfStock + stock.critical > 0) {
    const parts = [
      stock.outOfStock > 0 ? `${stock.outOfStock} tükendi` : null,
      stock.critical > 0 ? `${stock.critical} kritik seviyede` : null,
    ].filter(Boolean)
    alerts.push({
      title: `${stock.outOfStock + stock.critical} parçada stok azaldı`,
      sub: parts.join(" · "),
      href: stock.outOfStock > 0 ? "/parts?status=out_of_stock" : "/parts?status=critical",
      icon: Package,
      tone: stock.outOfStock > 0 ? "destructive" : "warning",
    })
  }

  if (overdueReminders != null && overdueReminders > 0) {
    alerts.push({
      title: `${overdueReminders} müşterinin bakımı gecikti`,
      sub: "Bakım hatırlatması tarihi geçti",
      href: "/reminders",
      icon: Bell,
      tone: "warning",
    })
  }

  return (
    <DashPanel title="Dikkat gerektiren işler" meta={alerts.length > 0 ? alerts.length : undefined} bare>
      <div className={surface.notes}>
        {alerts.length === 0 ? (
          <div className={surface.note}>
            <DashTile tone="success" circle><Check /></DashTile>
            <span className={surface.rowMain}>
              <span className={surface.rowTitle}>Her şey yolunda</span>
              <span className={surface.rowSub}>Müdahale bekleyen bir iş yok</span>
            </span>
          </div>
        ) : alerts.map((alert) => {
          const Icon = alert.icon
          return (
            <Link key={alert.href + alert.title} href={alert.href} prefetch={false} className={surface.note}>
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
