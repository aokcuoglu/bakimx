"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatKurus } from "@/lib/money"
import { formatDiscountLabel } from "@/lib/parts/bakimx-price"
import {
  BAKIMX_ORDER_STATUS_LABELS,
  bakimxOrderTransitions,
  type BakimxOrderStatusValue,
} from "@/lib/catalog/bakimx-order"
import { updateBakimxOrderStatusAction } from "@/app/admin/catalog/orders/actions"
import type {
  AdminOrderRow,
  AdminOrderWorkshopOption,
  OrderStatusFilter,
} from "@/app/admin/catalog/orders/data"

/**
 * Gelen sipariş taleplerinin listesi ve durum geçişleri (BAK-60).
 *
 * Geçiş düğmeleri `bakimxOrderTransitions` tablosundan üretilir — ekranın kendi
 * "hangi durumdan hangisine" listesi YOKTUR, aksi hâlde sunucu bir geçişi
 * reddederken düğme görünmeye devam ederdi.
 *
 * Stok uyarısı sevkiyattan ÖNCE görünür: rezervasyon olmadığı için iki atölye
 * aynı stoğu istemiş olabilir ve admin bunu görmeden sevk etmemeli.
 */

type SerializedOrder = Omit<AdminOrderRow, "createdAt" | "confirmedAt" | "shippedAt" | "cancelledAt"> & {
  createdAt: string
  confirmedAt: string | null
  shippedAt: string | null
  cancelledAt: string | null
}

const STATUS_FILTERS: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "Tüm durumlar" },
  { value: "requested", label: BAKIMX_ORDER_STATUS_LABELS.requested },
  { value: "confirmed", label: BAKIMX_ORDER_STATUS_LABELS.confirmed },
  { value: "shipped", label: BAKIMX_ORDER_STATUS_LABELS.shipped },
  { value: "cancelled", label: BAKIMX_ORDER_STATUS_LABELS.cancelled },
]

const STATUS_BADGE: Record<
  BakimxOrderStatusValue,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  requested: { variant: "outline" },
  confirmed: { variant: "secondary" },
  shipped: { variant: "default", className: "bg-success/15 text-success-strong" },
  cancelled: { variant: "destructive" },
}

/** Sevkiyat stok düşürür ve geri alınamaz — uyarı varken ekstra onay istenir. */
function shipConfirmationMessage(order: SerializedOrder): string {
  const lines = order.items
    .filter((i) => i.shortfall > 0)
    .map((i) => `• ${i.name}: ${i.quantity} isteniyor, stok ${i.stockQty ?? 0}`)
  return [
    "Bu siparişte stok yetersiz:",
    ...lines,
    "",
    "Yine de gönderildi olarak işaretlensin mi? Stok bu adetler kadar düşecek.",
  ].join("\n")
}

export function OrdersList({
  rows,
  total,
  truncated,
  workshops,
  filters,
}: {
  rows: SerializedOrder[]
  total: number
  truncated: boolean
  workshops: AdminOrderWorkshopOption[]
  filters: { status: OrderStatusFilter; workshopId: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function pushFilters(next: Partial<{ status: OrderStatusFilter; workshopId: string }>) {
    const merged = { ...filters, ...next }
    const params = new URLSearchParams()
    if (merged.status !== "all") params.set("status", merged.status)
    if (merged.workshopId) params.set("workshop", merged.workshopId)
    const qs = params.toString()
    router.push(`/admin/catalog/orders${qs ? `?${qs}` : ""}`)
  }

  function transition(order: SerializedOrder, next: BakimxOrderStatusValue) {
    if (next === "shipped" && order.hasShortfall && !window.confirm(shipConfirmationMessage(order))) {
      return
    }
    startTransition(async () => {
      const result = await updateBakimxOrderStatusAction({ orderId: order.id, status: next })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Sipariş "${BAKIMX_ORDER_STATUS_LABELS[next]}" olarak işaretlendi.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Sipariş Talepleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atölyelerin BakımX kataloğundan istediği ürünler. Stok yalnız “Gönderildi”
            işaretlendiğinde düşer.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/catalog">
            <ArrowLeft className="size-3.5 mr-1" /> Katalog
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <Select
            value={filters.status}
            onValueChange={(v) => pushFilters({ status: (v ?? "all") as OrderStatusFilter })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tüm durumlar">
                {(value: string | null) =>
                  value ? STATUS_FILTERS.find((s) => s.value === value)?.label ?? value : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.workshopId} onValueChange={(v) => pushFilters({ workshopId: v ?? "" })}>
            <SelectTrigger>
              <SelectValue placeholder="Tüm atölyeler">
                {(value: string | null) =>
                  value ? workshops.find((w) => w.id === value)?.name ?? value : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm atölyeler</SelectItem>
              {workshops.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto self-center text-xs text-muted-foreground">
            {total} sipariş{truncated && ` · ilk ${rows.length} tanesi gösteriliyor`}
          </span>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Bu filtrelere uyan sipariş talebi yok.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((order) => {
            const badge = STATUS_BADGE[order.status]
            const nextStates = bakimxOrderTransitions(order.status)
            return (
              <Card key={order.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badge.variant} className={badge.className}>
                        {BAKIMX_ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{order.workshopName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("tr-TR")}
                      </span>
                      {order.hasShortfall && order.status !== "cancelled" && (
                        <span className="flex items-center gap-1 text-xs text-warning-strong">
                          <AlertTriangle className="size-3.5" /> Stok yetersiz
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatKurus(order.totalKurus)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">KDV hariç</span>
                    </span>
                  </div>

                  <ul className="divide-y divide-border/60 text-sm">
                    {order.items.map((item) => {
                      const discountNote = formatDiscountLabel(item.discountBps)
                      return (
                        <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                          <span className="text-xs text-muted-foreground">
                            · {item.quantity} × {formatKurus(item.unitPriceKurus)}
                          </span>
                          {discountNote && (
                            <span className="text-xs text-success-strong">· {discountNote}</span>
                          )}
                          <span
                            className={
                              item.shortfall > 0
                                ? "text-xs text-warning-strong"
                                : "text-xs text-muted-foreground"
                            }
                          >
                            · Stok: {item.stockQty ?? "—"}
                            {item.shortfall > 0 && ` (${item.shortfall} eksik)`}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  {order.note && <p className="text-xs text-muted-foreground">Not: {order.note}</p>}

                  {nextStates.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                      {nextStates.map((next) => (
                        <Button
                          key={next}
                          type="button"
                          size="sm"
                          variant={next === "cancelled" ? "outline" : "default"}
                          disabled={pending}
                          onClick={() => transition(order, next)}
                        >
                          {pending && <Loader2 className="size-3.5 animate-spin" />}
                          {BAKIMX_ORDER_STATUS_LABELS[next]} olarak işaretle
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
