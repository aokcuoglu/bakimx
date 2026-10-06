"use client"

import Link from "next/link"
import { StatusBadge, PlateBadge } from "@/components/shared/status-badge"
import type { TodayDelivery } from "@/lib/dashboard/queries"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function TodayDeliveries({ deliveries }: { deliveries: TodayDelivery[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(deliveries)

  return (
    <section aria-label="Bugün teslim edilecekler" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Bugün Teslim Edilecekler</h3>
        <span className="text-xs text-muted-foreground">{deliveries.length} kayıt</span>
      </div>
      {deliveries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Bugün teslim edilecek iş emri yok.</p>
      ) : (
        <Table className="table-fixed" aria-label="Bugünkü teslimatlar">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 px-4 text-xs">Araç / Müşteri</TableHead>
              <TableHead className="h-9 w-28 px-4 text-right text-xs">Durum / Saat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="px-4 py-1.5 whitespace-normal">
                  <Link href={`/orders/${d.id}`} className="block min-w-0 space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <PlateBadge plate={d.plate} size="sm" />
                    <span className="block truncate text-xs text-muted-foreground">{d.customerName}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{d.workOrderNo}</span>
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right whitespace-normal">
                  <StatusBadge status={d.status} />
                  {d.estimatedDeliveryAt && <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{formatTime(d.estimatedDeliveryAt)}</span>}
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
