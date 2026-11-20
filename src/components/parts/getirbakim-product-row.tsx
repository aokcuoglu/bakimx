"use client"

import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTRY } from "@/lib/format"
import {
  GETIRBAKIM_SOURCE_LABEL,
  getirbakimDiscountLabel,
  getirbakimFreshnessLabel,
  getirbakimStockLabel,
} from "@/lib/parts/getirbakim/labels"
import { isGetirbakimSelectable } from "@/lib/parts/getirbakim-item"
import { getirbakimFitLevel } from "@/lib/parts/getirbakim/fitment"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"
import { cn } from "@/lib/utils"

/**
 * Parça seçicideki tek GetirBakım satırı — `BakimxProductRow`'un kardeşi.
 *
 * KAYNAK ROZETİ satırdan kaldırılmamalı: TecDoc (RapidAPI) makaleleriyle aynı
 * listede durur. Rozet olmadan atölye, stoğu TecDoc kataloğu ya da bizim
 * depomuz sanır.
 *
 * FİYAT: gösterilen tutar atölyenin GetirBakım'dan **ALIŞ** fiyatıdır, KDV
 * hariç (`b2bPriceKurus`). Liste fiyatını (`listPriceKurus`) basmıyoruz.
 *
 * `onSelect` verilirse satır kalem ekler (alanlar `getirbakimLineItemFields`).
 * Verilmezse salt okunur kalır — kalemi yazamayan çağıran ürünü seçtirmemeli.
 * `UNAVAILABLE` satır seçilemez.
 */
export function GetirbakimProductRow({
  product,
  onSelect,
  nested = false,
}: {
  product: GetirbakimProduct
  onSelect?: () => void
  nested?: boolean
}) {
  const unavailable = product.availability === "UNAVAILABLE"
  const selectable = !!onSelect && isGetirbakimSelectable(product)
  const discountNote = getirbakimDiscountLabel(product.discountBps)
  const fitLevel = getirbakimFitLevel(product)

  const body = (
    <>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded object-contain bg-white border border-border/60"
        />
      ) : (
        <span className="size-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
          <Truck className="size-4 text-primary-strong" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{product.name}</span>
          <span className="shrink-0 rounded-sm border border-primary/20 bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary-strong">
            {GETIRBAKIM_SOURCE_LABEL}
          </span>
          {fitLevel === "guaranteed" && (
            <span className="shrink-0 rounded-sm bg-success/10 px-1.5 py-px text-[10px] font-medium text-success-strong">
              Araca tam uyumlu
            </span>
          )}
          {/* Model düzeyinde uyum (#755): ikincil, dolgusuz — "tam uyumlu" ile karışmasın. */}
          {fitLevel === "likely" && (
            <span className="shrink-0 rounded-sm border border-success/30 px-1.5 py-px text-[10px] font-medium text-success-strong">
              Muhtemelen uyumlu
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          <span className="font-mono">{product.partNo}</span>
          {product.brandName && <> · {product.brandName}</>}
          {product.categoryName && <> · {product.categoryName}</>}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
          {product.b2bPriceKurus != null ? (
            <>
              <span className="font-semibold tabular-nums text-foreground">
                Alış: {formatTRY(product.b2bPriceKurus)}
              </span>
              <span className="text-muted-foreground">KDV hariç</span>
            </>
          ) : (
            <span className="text-muted-foreground">Fiyat sorulur</span>
          )}
          <span className={cn(unavailable ? "text-warning-strong" : "text-muted-foreground")}>
            · {getirbakimStockLabel(product)}
          </span>
          {discountNote && <span className="text-success-strong">· {discountNote}</span>}
          <span className="text-muted-foreground">
            · {getirbakimFreshnessLabel(product.lastSyncedAt)}
          </span>
        </span>
      </span>
    </>
  )

  const rowClass = cn(
    "flex min-w-0 items-center gap-3 border-b border-border/60 px-3 py-2 text-left",
    nested && "bg-primary/5 pl-8",
    !nested && "border-l-2 border-l-primary/40",
    selectable && "hover:bg-muted",
  )

  if (selectable) {
    return (
      <Button type="button" variant="ghost" onClick={onSelect} className={cn(rowClass, "h-auto w-full justify-start whitespace-normal")}>
        {body}
      </Button>
    )
  }

  return <div className={rowClass}>{body}</div>
}
