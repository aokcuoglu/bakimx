"use client"

import Link from "next/link"
import type { MissingPhotoItem } from "@/lib/dashboard/queries"
import { Camera, ChevronRight } from "lucide-react"
import { PlateBadge } from "@/components/shared/status-badge"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"

export function MissingPhotos({ items }: { items: MissingPhotoItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(items)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Eksik Fotoğraflar</h3>
      </div>
      <div className="max-h-96 divide-y divide-border overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Eksik fotoğraf bulunmuyor.
          </p>
        ) : (
          pageItems.map((item) => (
            <Link
              key={item.orderId}
              href={`/orders/${item.orderId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="size-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Camera className="size-4 text-destructive-strong" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <PlateBadge plate={item.plate} />
                  <span className="text-xs font-mono text-muted-foreground">{item.workOrderNo}</span>
                </div>
                <p className="text-sm text-foreground truncate">{item.customerName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold text-destructive-strong">-{item.missingCount}</span>
                <ChevronRight className="size-3.5 text-muted-foreground mt-0.5 ml-auto" />
              </div>
            </Link>
          ))
        )}
      </div>
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  )
}
