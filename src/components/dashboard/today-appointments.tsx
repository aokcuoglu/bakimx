import type { TodayAppointmentRow } from "@/lib/dashboard/queries"
import { DashAppointmentStatus, DashEmpty, DashPanel, DashRow, DashTile, formatTime } from "@/components/dashboard/surface"

export function TodayAppointments({ appointments }: { appointments: TodayAppointmentRow[] }) {
  return (
    <DashPanel title="Bugünkü randevular" action={{ href: "/appointments", label: "Tümünü gör" }}>
      {appointments.length === 0 ? (
        <DashEmpty>Bugün için planlanmış randevu yok.</DashEmpty>
      ) : (
        appointments.map((a) => (
          <DashRow
            key={a.id}
            href={`/appointments/${a.id}`}
            start={<DashTile tone="info">{formatTime(a.appointmentAt)}</DashTile>}
            title={a.customerName}
            sub={[a.plate, a.appointmentNo].filter(Boolean).join(" · ")}
            end={<DashAppointmentStatus status={a.status} />}
            chevron={false}
          />
        ))
      )}
    </DashPanel>
  )
}
