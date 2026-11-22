import type { CriticalSupplierInfo } from "@/lib/suppliers/queries"
import { DashPanel, DashPill, DashRow, DashTile, initials } from "@/components/dashboard/surface"

export function CriticalStockSuppliersWidget({ suppliers }: { suppliers: CriticalSupplierInfo[] }) {
  if (suppliers.length === 0) return null

  return (
    <DashPanel title="Kritik stok tedarikçileri" action={{ href: "/suppliers", label: "Tümünü gör" }}>
      {suppliers.map((s) => (
        <DashRow
          key={s.id}
          href={`/suppliers/${s.id}`}
          start={<DashTile tone="neutral">{initials(s.name)}</DashTile>}
          title={s.name}
          sub={s.phone || undefined}
          end={<DashPill tone="warning">{s.criticalPartCount} parça</DashPill>}
          chevron={false}
        />
      ))}
    </DashPanel>
  )
}
