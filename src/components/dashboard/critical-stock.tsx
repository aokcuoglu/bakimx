import type { CriticalStockItem } from "@/lib/parts/queries"
import { DashPanel, DashPill, DashRow, surface } from "@/components/dashboard/surface"

export function CriticalStockWidget({ items }: { items: CriticalStockItem[] }) {
  if (items.length === 0) return null

  return (
    <DashPanel
      title="Kritik stok"
      meta={items.length}
      action={{ href: "/parts?status=critical", label: "Tümünü gör" }}
    >
      {items.slice(0, 5).map((item) => (
        <DashRow
          key={item.id}
          href={`/parts/${item.id}`}
          title={item.name}
          sub={[item.sku, item.oemNo].filter(Boolean).join(" · ") || undefined}
          end={
            <>
              <DashPill tone={item.status === "out_of_stock" ? "destructive" : "warning"}>
                {item.status === "out_of_stock" ? "Stok yok" : `Son ${item.stockQty} adet`}
              </DashPill>
              {item.criticalStockQty > 0 && <span className={surface.rowEndText}>Kritik: {item.criticalStockQty}</span>}
            </>
          }
          chevron={false}
        />
      ))}
    </DashPanel>
  )
}
