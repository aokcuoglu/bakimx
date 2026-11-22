"use client"

import Link from "next/link"
import type { MissingPhotoItem } from "@/lib/dashboard/queries"
import { ChevronRight } from "lucide-react"
import { PlateBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"

export function MissingPhotos({ items }: { items: MissingPhotoItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(items)

  return (
    <section aria-label="Eksik fotoğraflar" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Eksik Fotoğraflar</h3>
        <span className="text-xs text-muted-foreground">{items.length} kayıt</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Eksik fotoğraf bulunmuyor.</p>
      ) : (
        <Table className="table-fixed" aria-label="Fotoğrafı eksik araç kabulleri">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 px-4 text-xs">Araç / Müşteri</TableHead>
              <TableHead className="h-9 w-28 px-4 text-right text-xs">Araç kabulü / Eksik</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow key={item.orderId}>
                <TableCell className="px-4 py-1.5 whitespace-normal">
                  <Link href={`/orders/${item.orderId}`} className="block min-w-0 space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <PlateBadge plate={item.plate} size="sm" />
                    <span className="block truncate text-xs text-muted-foreground">{item.customerName}</span>
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right">
                  <span className="block font-mono text-xs text-muted-foreground">{item.workOrderNo}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive-strong">
                    {item.missingCount} eksik <ChevronRight aria-hidden className="size-3" />
                  </span>
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
