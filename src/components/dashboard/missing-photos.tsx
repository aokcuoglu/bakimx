"use client"

import type { MissingPhotoItem } from "@/lib/dashboard/queries"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"
import { DashEmpty, DashPanel, DashPill, DashPlate, DashRow } from "@/components/dashboard/surface"

export function MissingPhotos({ items }: { items: MissingPhotoItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(items)

  return (
    <DashPanel title="Eksik fotoğraflar" meta={items.length > 0 ? items.length : undefined}>
      {items.length === 0 ? (
        <DashEmpty>Eksik fotoğraf yok.</DashEmpty>
      ) : (
        pageItems.map((item) => (
          <DashRow
            key={item.orderId}
            href={`/orders/${item.orderId}`}
            start={<DashPlate plate={item.plate} />}
            title={item.customerName}
            sub={item.workOrderNo}
            end={<DashPill tone="destructive">{item.missingCount} eksik</DashPill>}
          />
        ))
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </DashPanel>
  )
}
