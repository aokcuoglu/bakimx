"use client"

import Link from "next/link"
import { StatusBadge, PlateBadge } from "@/components/shared/status-badge"
import { formatTRY } from "@/lib/format"
import type { ActiveWorkOrderRow } from "@/lib/dashboard/queries"
import { Eye, MessageCircle, ChevronRight, Camera, XCircle } from "lucide-react"
import { useDashboardPage, DashboardPagination } from "@/components/dashboard/dashboard-pagination"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

function approvalBadge(status: string | null) {
  if (!status) return null
  if (status === "waiting_approval") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning-strong font-medium">
        <MessageCircle className="size-3" />
        Bekliyor
      </span>
    )
  }
  return null
}

function photoBadge(completion: { present: number; required: number }) {
  if (completion.present >= completion.required) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success-strong font-medium">
        <Camera className="size-3" />
        {completion.present}/{completion.required}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive-strong font-medium">
      <XCircle className="size-3" />
      {completion.present}/{completion.required}
    </span>
  )
}

export function ActiveOrdersDesktop({ orders }: { orders: ActiveWorkOrderRow[] }) {
  return (
    <div className="bg-card">
      <Table containerClassName="max-h-96" aria-label="Aktif araç kabulleri">
        <TableHeader className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-left font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">İş No</TableHead>
            <TableHead className="text-left font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Plaka / Araç</TableHead>
            <TableHead className="text-left font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Müşteri</TableHead>
            <TableHead className="text-left font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Durum</TableHead>
            <TableHead className="text-center font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Onay</TableHead>
            <TableHead className="text-center font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Fotoğraf</TableHead>
            <TableHead className="text-right font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Toplam</TableHead>
            <TableHead className="text-left font-medium text-muted-foreground h-9 bg-card px-3 py-1 text-xs">Tahmini Teslim</TableHead>
            <TableHead className="sticky right-0 z-20 h-9 border-l border-border bg-card px-3 py-1 text-right text-xs text-muted-foreground">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                Aktif araç kabulü bulunmuyor.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((o) => (
              <TableRow key={o.id} className="group hover:bg-muted/60">
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap">
                  <span className="font-mono text-xs font-medium text-foreground">{o.workOrderNo}</span>
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <PlateBadge plate={o.plate} size="sm" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{o.plate} · {o.brand} {o.model}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="block max-w-[11rem] truncate text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{o.customerName}</span>
                    </TooltipTrigger>
                    <TooltipContent>{o.customerName}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap">
                  <StatusBadge status={o.status} />
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap text-center">
                  {approvalBadge(o.approvalStatus)}
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap text-center">
                  {photoBadge(o.photoCompletion)}
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap text-right">
                  {o.hasPrice ? (
                    <span className="text-sm font-semibold text-foreground tabular-nums">{formatTRY(o.total)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="h-9 px-3 py-1 align-middle whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                    {o.estimatedDeliveryAt ? (
                      <>
                        <span>{formatDate(o.estimatedDeliveryAt)}</span>
                        <span>{formatTime(o.estimatedDeliveryAt)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belirtilmemiş</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="sticky right-0 border-l border-border bg-card h-9 px-3 py-1 align-middle whitespace-nowrap text-right group-hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="secondary" size="compact" asChild>
                      <Link href={`/orders/${o.id}`}>
                        <Eye className="size-3" />
                        Görüntüle
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function ActiveOrdersMobile({ orders }: { orders: ActiveWorkOrderRow[] }) {
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto sm:hidden">
      {orders.length === 0 ? (
        <div className="text-center py-10 bg-card border border-dashed border-border rounded-lg">
          <p className="text-sm font-medium text-muted-foreground">Aktif araç kabulü bulunmuyor.</p>
        </div>
      ) : (
        orders.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block bg-card border border-border rounded-lg p-3 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-mono text-xs font-semibold text-muted-foreground">{o.workOrderNo}</span>
                <div className="flex items-center gap-2 mt-1">
                  <PlateBadge plate={o.plate} size="sm" />
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground mt-1 shrink-0" />
            </div>
            <p className="text-sm text-foreground mb-2">{o.customerName}</p>
            <div className="flex items-center flex-wrap gap-1.5 mb-2">
              <StatusBadge status={o.status} />
              {o.approvalStatus === "waiting_approval" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-warning-strong font-medium bg-warning/10 px-2 py-0.5 rounded-full">
                  <MessageCircle className="size-3" />
                  Onay Bekliyor
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{photoBadge(o.photoCompletion)}</span>
                {o.estimatedDeliveryAt && (
                  <span>Teslim: {formatDate(o.estimatedDeliveryAt)}</span>
                )}
              </div>
              {o.hasPrice && (
                <span className="font-semibold text-foreground">{formatTRY(o.total)}</span>
              )}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}

export function ActiveOrdersSection({ orders }: { orders: ActiveWorkOrderRow[] }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(orders)

  return (
    <section aria-label="Aktif araç kabulleri">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Aktif Araç Kabulleri</h3>
        <Link
          href="/orders"
          className="text-sm text-primary hover:underline font-medium transition-colors"
        >
          Tümünü Gör →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="hidden sm:block">
          <ActiveOrdersDesktop orders={pageItems} />
        </div>
        <div className="p-2 sm:hidden">
          <ActiveOrdersMobile orders={pageItems} />
        </div>
        {pageCount > 1 && (
          <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
        )}
      </div>
    </section>
  )
}
