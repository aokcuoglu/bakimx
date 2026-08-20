"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { computeDashboardPage } from "@/lib/dashboard/pagination"

export const DASHBOARD_PAGE_SIZE = 5

export function useDashboardPage<T>(items: T[], pageSize: number = DASHBOARD_PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const { page: currentPage, pageCount, pageItems } = computeDashboardPage(items, page, pageSize)
  return { page: currentPage, pageCount, pageItems, setPage }
}

export function DashboardPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
        aria-label="Önceki sayfa"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-xs text-muted-foreground">
        Sayfa {page + 1} / {pageCount}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        aria-label="Sonraki sayfa"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
