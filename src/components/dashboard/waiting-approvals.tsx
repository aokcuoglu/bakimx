"use client"

import Link from "next/link"
import type { WaitingApprovalItem } from "@/lib/dashboard/queries"
import { ExternalLink } from "lucide-react"
import { PlateBadge } from "@/components/shared/status-badge"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function WaitingApprovals({ approvals }: { approvals: WaitingApprovalItem[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(approvals)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Onay Bekleyenler</h3>
      </div>
      <div className="max-h-96 divide-y divide-border overflow-y-auto">
        {approvals.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Onay bekleyen kayıt yok.
          </p>
        ) : (
          pageItems.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlateBadge plate={a.plate} />
                    <span className="text-xs font-mono text-muted-foreground">{a.workOrderNo}</span>
                  </div>
                  <p className="text-sm text-foreground truncate">{a.customerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Link
                  href={`/orders/${a.id}`}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-warning/10 hover:bg-warning/20 text-xs font-medium text-warning-foreground transition-colors touch-manipulation"
                >
                  <ExternalLink className="size-3" />
                  İş Emri Detayı
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  )
}
