import type { InServiceStatusCount } from "@/lib/dashboard/queries"
import { ORDER_STATUS } from "@/lib/constants"
import { DashEmpty, DashPanel, DashRow, surface } from "@/components/dashboard/surface"

/**
 * Serviste araçların hangi aşamada olduğu, oran çubuklu liste (meter list):
 * her satırda ad, toplam içindeki payı gösteren tek renkli çubuk ve adet.
 * Yüzde yazılmaz: yuvarlama ya toplamı 100'den saptırıyor ya da aynı adete
 * farklı yüzde veriyordu; oranı çubuk, toplamı başlık ("27 araç") taşır.
 * Kategorik renk kullanılmaz — altı durumu renkle ayırmak renk körlüğünde
 * çakışıyordu; ayrımı ad taşır, çubuk yalnız büyüklüğü gösterir.
 * Toplam "Serviste" sayacına eşittir; her satır o durumun listesini açar.
 */
export function WorkshopStatus({ counts }: { counts: InServiceStatusCount[] }) {
  const total = counts.reduce((sum, c) => sum + c.count, 0)

  return (
    <DashPanel title="Atölye durumu" meta={total > 0 ? `${total} araç` : undefined}>
      {total === 0 ? (
        <DashEmpty>Serviste araç yok.</DashEmpty>
      ) : (
        counts.map((c) => {
          return (
            <DashRow
              key={c.status}
              href={`/orders?status=${c.status}`}
              title={ORDER_STATUS[c.status].label}
              sub={
                <span aria-hidden className={surface.meter}>
                  <span className={surface.meterFill} style={{ width: `${(c.count / total) * 100}%` }} />
                </span>
              }
              end={<span className={surface.meterFigure}>{c.count}</span>}
            />
          )
        })
      )}
    </DashPanel>
  )
}
