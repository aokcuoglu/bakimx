"use client"

import Link from "next/link"
import type { WaitingApprovalItem } from "@/lib/dashboard/queries"
import { PlateBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function WaitingApprovals({ approvals }: { approvals: WaitingApprovalItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(approvals)

  return (
    <section aria-label="Onay bekleyenler" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Onay Bekleyenler</h3>
        <span className="text-xs text-muted-foreground">{approvals.length} kayıt</span>
      </div>
      {approvals.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Onay bekleyen kayıt yok.</p>
      ) : (
        <Table className="table-fixed" aria-label="Onay bekleyen iş emirleri">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 px-4 text-xs">Araç / Müşteri</TableHead>
              <TableHead className="h-9 w-28 px-4 text-right text-xs">İş emri / Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="px-4 py-1.5 whitespace-normal">
                  <Link href={`/orders/${a.id}`} className="block min-w-0 space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <PlateBadge plate={a.plate} size="sm" />
                    <span className="block truncate text-xs text-muted-foreground">{a.customerName}</span>
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right text-xs text-muted-foreground">
                  <span className="block font-mono">{a.workOrderNo}</span>
                  <span className="mt-1 block tabular-nums">{formatDate(a.createdAt)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </section>
  )
}
