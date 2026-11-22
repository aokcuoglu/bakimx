import type { InServiceStatusCount } from "@/lib/dashboard/queries"
import { ORDER_STATUS } from "@/lib/constants"
import { DashEmpty, DashPanel, DashRow, surface } from "@/components/dashboard/surface"

/**
 * Serviste araçların hangi aşamada olduğu. Toplam "Serviste" sayacına eşittir;
 * her satır o durumla filtrelenmiş listeyi açar.
 */
export function WorkshopStatus({ counts }: { counts: InServiceStatusCount[] }) {
  return (
    <DashPanel title="Atölye durumu">
      {counts.length === 0 ? (
        <DashEmpty>Serviste araç yok.</DashEmpty>
      ) : (
        counts.map((c) => (
          <DashRow
            key={c.status}
            href={`/orders?status=${c.status}`}
            plain
            title={ORDER_STATUS[c.status].label}
            end={<span className={surface.rowValue}>{c.count}</span>}
          />
        ))
      )}
    </DashPanel>
  )
}
