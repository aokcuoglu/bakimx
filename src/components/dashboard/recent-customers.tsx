import type { RecentCustomer } from "@/lib/dashboard/queries"
import { DashEmpty, DashPanel, DashRow, DashTile, formatShortDate, initials, surface } from "@/components/dashboard/surface"

export function RecentCustomers({ customers }: { customers: RecentCustomer[] }) {
  return (
    <DashPanel title="Son müşteriler" action={{ href: "/customers", label: "Tümünü gör" }}>
      {customers.length === 0 ? (
        <DashEmpty>Henüz müşteri kaydı yok.</DashEmpty>
      ) : (
        customers.map((c) => (
          <DashRow
            key={c.id}
            href={`/customers/${c.id}`}
            start={<DashTile tone="info" circle>{initials(c.name)}</DashTile>}
            title={c.name}
            sub={c.phone}
            end={<span className={surface.rowEndText}>{formatShortDate(c.createdAt)}</span>}
          />
        ))
      )}
    </DashPanel>
  )
}
