"use client"

import type { TodayDelivery } from "@/lib/dashboard/queries"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"
import { DashEmpty, DashOrderStatus, DashPanel, DashPlate, DashRow, formatTime, surface } from "@/components/dashboard/surface"

export function TodayDeliveries({ deliveries }: { deliveries: TodayDelivery[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(deliveries)

  return (
    <DashPanel title="Bugün teslim" meta={deliveries.length > 0 ? deliveries.length : undefined}>
      {deliveries.length === 0 ? (
        <DashEmpty>Bugün teslim edilecek araç yok.</DashEmpty>
      ) : (
        pageItems.map((d) => (
          <DashRow
            key={d.id}
            href={`/orders/${d.id}`}
            stack
            start={<DashPlate plate={d.plate} />}
            title={d.customerName}
            sub={d.workOrderNo}
            end={
              <>
                <DashOrderStatus status={d.status} />
                {d.estimatedDeliveryAt && <span className={surface.rowEndText}>{formatTime(d.estimatedDeliveryAt)}</span>}
              </>
            }
            chevron={false}
          />
        ))
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </DashPanel>
  )
}
