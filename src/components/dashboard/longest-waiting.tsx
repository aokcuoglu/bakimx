import type { InServiceOrderRow } from "@/lib/dashboard/queries"
import { IN_SERVICE_ORDER_FILTER } from "@/lib/orders/status-filter"
import { DashEmpty, DashOrderStatus, DashPanel, DashRow } from "@/components/dashboard/surface"
import { Plate } from "@/components/shared/plate"

function waitingText(days: number): string {
  if (days === 0) return "Bugün geldi"
  if (days === 1) return "Dünden beri serviste"
  return `${days} gündür serviste`
}

/** Atölyede en uzun bekleyen araçlar — tıkanan işi yöneticinin önüne getirir. */
export function LongestWaiting({ orders }: { orders: InServiceOrderRow[] }) {
  return (
    <DashPanel
      title="En uzun bekleyenler"
      action={orders.length > 0 ? { href: `/orders?status=${IN_SERVICE_ORDER_FILTER}`, label: "Tümünü gör" } : undefined}
    >
      {orders.length === 0 ? (
        <DashEmpty>Serviste araç yok.</DashEmpty>
      ) : (
        orders.map((o) => (
          <DashRow
            key={o.id}
            href={`/orders/${o.id}`}
            stack
            start={<Plate plate={o.plate} size="lg" />}
            title={o.customerName}
            sub={[waitingText(o.daysInService), [o.brand, o.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            end={<DashOrderStatus status={o.status} />}
          />
        ))
      )}
    </DashPanel>
  )
}
