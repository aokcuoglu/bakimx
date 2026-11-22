import type { TodayAppointmentRow, TodayDelivery } from "@/lib/dashboard/queries"
import {
  DashAppointmentStatus,
  DashEmpty,
  DashOrderStatus,
  DashPanel,
  DashPlate,
  DashRow,
  DashTile,
  formatTime,
} from "@/components/dashboard/surface"

type AgendaItem = {
  key: string
  at: string | null
  href: string
  plate: string | null
  title: string
  sub: string
  status: React.ReactNode
}

/**
 * Günün programı: bugün teslim edilecek araçlar ve bugünkü randevular, saate
 * göre tek listede. Randevu özelliği pakette yoksa yalnız teslimler gelir.
 */
export function TodayAgenda({
  deliveries,
  appointments,
}: {
  deliveries: TodayDelivery[]
  appointments: TodayAppointmentRow[]
}) {
  const items: AgendaItem[] = [
    ...deliveries.map((d) => ({
      key: `d-${d.id}`,
      at: d.estimatedDeliveryAt,
      href: `/orders/${d.id}`,
      plate: d.plate,
      title: d.customerName,
      sub: ["Teslim", formatTime(d.estimatedDeliveryAt), [d.brand, d.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
      status: <DashOrderStatus status={d.status} />,
    })),
    ...appointments.map((a) => ({
      key: `a-${a.id}`,
      at: a.appointmentAt,
      href: `/appointments/${a.id}`,
      plate: a.plate,
      title: a.customerName,
      sub: ["Randevu", formatTime(a.appointmentAt), [a.brand, a.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
      status: <DashAppointmentStatus status={a.status} />,
    })),
  ].sort((x, y) => (x.at ?? "").localeCompare(y.at ?? ""))

  return (
    <DashPanel title="Bugün" meta={items.length > 0 ? items.length : undefined}>
      {items.length === 0 ? (
        <DashEmpty>Bugün için teslim ya da randevu yok.</DashEmpty>
      ) : (
        items.map((item) => (
          <DashRow
            key={item.key}
            href={item.href}
            stack
            start={
              item.plate
                ? <DashPlate plate={item.plate} country size="lg" />
                : <DashTile tone="info">{formatTime(item.at)}</DashTile>
            }
            title={item.title}
            sub={item.sub}
            end={item.status}
          />
        ))
      )}
    </DashPanel>
  )
}
