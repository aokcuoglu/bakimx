import type { DashboardStats } from "@/lib/dashboard/queries"
import { DashStat, DashStatGrid } from "@/components/dashboard/surface"

type KpiItem = {
  label: string
  value: number
  href: string
  tone?: "warning" | "destructive"
}

export function KpiCards({
  stats,
  showQuotes,
  showPhotoChecklist,
}: {
  stats: DashboardStats
  showQuotes: boolean
  showPhotoChecklist: boolean
}) {
  const items: KpiItem[] = [
    { label: "Serviste", value: stats.activeOrders, href: "/orders" },
    { label: "Bugün teslim", value: stats.todayDeliveries, href: "/orders" },
    ...(showQuotes
      ? [{ label: "Onay bekleyen", value: stats.waitingApprovals, href: "/orders?status=waiting_approval", tone: "warning" as const }]
      : []),
    ...(showPhotoChecklist
      ? [{ label: "Eksik fotoğraf", value: stats.missingPhotoIntakes, href: "/orders", tone: "destructive" as const }]
      : []),
    { label: "Geciken teslim", value: stats.overdueDeliveries, href: "/orders", tone: "destructive" },
    { label: "Son 7 gün", value: stats.lastWeekOrders, href: "/orders" },
  ]

  return (
    <DashStatGrid label="Operasyon özeti" count={items.length}>
      {items.map((item) => (
        <DashStat
          key={item.label}
          label={item.label}
          value={item.value}
          href={item.href}
          tone={item.value > 0 ? item.tone : undefined}
        />
      ))}
    </DashStatGrid>
  )
}
