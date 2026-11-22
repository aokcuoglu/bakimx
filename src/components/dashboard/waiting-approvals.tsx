"use client"

import type { WaitingApprovalItem } from "@/lib/dashboard/queries"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"
import { DashEmpty, DashPanel, DashPlate, DashRow, formatShortDate, surface } from "@/components/dashboard/surface"

export function WaitingApprovals({ approvals }: { approvals: WaitingApprovalItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(approvals)

  return (
    <DashPanel title="Onay bekleyenler" meta={approvals.length > 0 ? approvals.length : undefined}>
      {approvals.length === 0 ? (
        <DashEmpty>Onay bekleyen araç kabulü yok.</DashEmpty>
      ) : (
        pageItems.map((a) => (
          <DashRow
            key={a.id}
            href={`/orders/${a.id}`}
            start={<DashPlate plate={a.plate} />}
            title={a.customerName}
            sub={a.workOrderNo}
            end={<span className={surface.rowEndText}>{formatShortDate(a.createdAt)}</span>}
            chevron={false}
          />
        ))
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </DashPanel>
  )
}
