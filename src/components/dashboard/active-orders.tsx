"use client"

import { formatTRY } from "@/lib/format"
import type { ActiveWorkOrderRow } from "@/lib/dashboard/queries"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"
import {
  DashEmpty,
  DashOrderStatus,
  DashPanel,
  DashPill,
  DashPlate,
  DashRow,
  formatShortDate,
  formatTime,
  surface,
} from "@/components/dashboard/surface"

function deliveryText(iso: string | null): string {
  if (!iso) return "Teslim belirtilmedi"
  return `Teslim ${formatShortDate(iso)} ${formatTime(iso)}`
}

export function ActiveOrdersSection({ orders }: { orders: ActiveWorkOrderRow[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(orders)

  return (
    <DashPanel
      title="Serviste"
      meta={orders.length > 0 ? orders.length : undefined}
      action={{ href: "/orders", label: "Tümünü gör" }}
    >
      {orders.length === 0 ? (
        <DashEmpty>Serviste araç yok.</DashEmpty>
      ) : (
        pageItems.map((o) => {
          const photosMissing = o.photoCompletion.present < o.photoCompletion.required
          const vehicle = [o.brand, o.model].filter(Boolean).join(" ")
          return (
            <DashRow
              key={o.id}
              href={`/orders/${o.id}`}
              stack
            start={<DashPlate plate={o.plate} />}
              title={o.customerName}
              sub={[vehicle, o.workOrderNo].filter(Boolean).join(" · ")}
              wide={
                <>
                  {o.hasPrice && <span className={surface.rowValue}>{formatTRY(o.total)}</span>}
                  <span className={surface.rowEndText}>{deliveryText(o.estimatedDeliveryAt)}</span>
                </>
              }
              end={
                <>
                  <DashOrderStatus status={o.status} />
                  {photosMissing && (
                    <span className={surface.mdOnly}>
                      <DashPill tone="destructive">
                        Foto {o.photoCompletion.present}/{o.photoCompletion.required}
                      </DashPill>
                    </span>
                  )}
                </>
              }
            />
          )
        })
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </DashPanel>
  )
}
