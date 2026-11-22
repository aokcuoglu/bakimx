import type { ComponentType } from "react"
import { AlertTriangle, CalendarCheck, MessageCircle, Wrench } from "lucide-react"
import type { DashboardStats } from "@/lib/dashboard/queries"
import { DashStat, DashStatGrid } from "@/components/dashboard/surface"
import { IN_SERVICE_ORDER_FILTER } from "@/lib/orders/status-filter"
import { DELIVERY_OVERDUE, DELIVERY_TODAY } from "@/lib/orders/delivery-filter"

type KpiItem = {
  label: string
  value: number
  href: string
  icon: ComponentType
  tone?: "warning" | "destructive"
}

/**
 * Güne başlarken bakılan dört sayı. Eksik fotoğraf ve dönemsel sayımlar
 * (son 7 gün, bu ay) burada yok: ilki "Dikkat gerektiren işler"de zaten
 * eyleme dönük satır olarak duruyor, dönemsel sayımlar Raporlar'ın işi.
 *
 * Her kart Araç Kabulleri listesini kendi sayımının filtresiyle açar; sayım
 * da aynı filtre tanımından gelir (bkz. getDashboardStats).
 */
export function KpiCards({
  stats,
  showQuotes,
}: {
  stats: DashboardStats
  showQuotes: boolean
}) {
  const items: KpiItem[] = [
    { label: "Serviste", value: stats.activeOrders, href: `/orders?status=${IN_SERVICE_ORDER_FILTER}`, icon: Wrench },
    { label: "Bugün teslim", value: stats.todayDeliveries, href: `/orders?delivery=${DELIVERY_TODAY}`, icon: CalendarCheck },
    ...(showQuotes
      ? [{
          label: "Onay bekleyen",
          value: stats.waitingApprovals,
          href: "/orders?status=waiting_approval",
          icon: MessageCircle,
          tone: "warning" as const,
        }]
      : []),
    { label: "Geciken teslim", value: stats.overdueDeliveries, href: `/orders?delivery=${DELIVERY_OVERDUE}`, icon: AlertTriangle, tone: "destructive" },
  ]

  return (
    <DashStatGrid label="Operasyon özeti" count={items.length}>
      {items.map(({ icon: Icon, ...item }) => (
        <DashStat
          key={item.label}
          label={item.label}
          value={item.value}
          href={item.href}
          icon={<Icon />}
          tone={item.value > 0 ? item.tone : undefined}
        />
      ))}
    </DashStatGrid>
  )
}
