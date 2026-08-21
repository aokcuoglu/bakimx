"use client"

import { Truck } from "lucide-react"
import { formatTRY } from "@/lib/format"
import {
  GETIRBAKIM_SOURCE_LABEL,
  getirbakimDiscountLabel,
  getirbakimFreshnessLabel,
  getirbakimStockLabel,
} from "@/lib/parts/getirbakim/labels"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"
import { cn } from "@/lib/utils"

/**
 * Parça seçicideki tek GetirBakım satırı — `BakimxProductRow`'un kardeşi
 * (BAK-183).
 *
 * KAYNAK ROZETİ satırdan kaldırılmamalı: bu satırlar BakımX kendi kataloğuyla
 * AYNI kutuda listeleniyor (BAK-182 kararı: dördüncü liste açılmıyor). Rozet
 * olmadan atölye, stoğu bizim depomuzda sanır.
 *
 * FİYAT: gösterilen tutar atölyenin GetirBakım'dan **ALIŞ** fiyatıdır, KDV
 * hariç (`b2bPriceKurus`). Liste fiyatını (`listPriceKurus`) basmıyoruz —
 * BakımX satırındaki BAK-47 kararıyla aynı gerekçe.
 *
 * SATIR BİLEREK TIKLANAMAZ. Bu issue entegrasyonun OKUMA yarısı: kalem eklemek
 * `OrderItemSource` enum'una `getirbakim` değeri (şema + migration) gerektirir,
 * o da ayrı bir karar ve ayrı bir PR. Buraya `manual` kaynaklı bir kalem
 * eklemek kısa yol olurdu ama parçanın GetirBakım'dan geldiği bilgisini
 * kaybederdik — sipariş aşaması tam da o izi arayacak. Satır şimdilik
 * "GetirBakım'da var mı, kaça, kaç adet" sorusunu cevaplar.
 */
export function GetirbakimProductRow({ product }: { product: GetirbakimProduct }) {
  const unavailable = product.availability === "UNAVAILABLE"
  const discountNote = getirbakimDiscountLabel(product.discountBps)

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border/60 px-3 py-2">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded object-contain bg-white border border-border/60"
        />
      ) : (
        <span className="size-10 shrink-0 rounded bg-muted flex items-center justify-center">
          <Truck className="size-4 text-muted-foreground" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{product.name}</span>
          <span className="shrink-0 rounded-sm border border-border bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
            {GETIRBAKIM_SOURCE_LABEL}
          </span>
          {product.exactFitment.status === "CONFIRMED" && (
            <span className="shrink-0 rounded-sm bg-success/10 px-1.5 py-px text-[10px] font-medium text-success-strong">
              Araca tam uyumlu
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
          {/* Tazelik notu KALDIRILMAMALI: bu uç anlık stok VAAT ETMEZ (BAK-183). */}
          <span className="text-muted-foreground">
            · {getirbakimFreshnessLabel(product.lastSyncedAt)}
          </span>
        </span>
      </span>
    </div>
  )
}
