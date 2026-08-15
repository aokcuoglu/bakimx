"use client"

import { Store } from "lucide-react"
import { formatTRY } from "@/lib/format"
import { bakimxStockLabel } from "@/lib/parts/bakimx-item"
import { formatDiscountLabel } from "@/lib/parts/bakimx-price"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import { cn } from "@/lib/utils"

/**
 * Parça seçicideki tek BakımX ürün satırı — hem kategori drill-down listesi hem
 * arama sonuçlarının "BakımX Ürünleri" bölümü bunu kullanır (TecdocArticleRow'un
 * kardeşi).
 *
 * FİYAT: gösterilen tutar atölyenin BakımX'ten **ALIŞ** fiyatıdır, KDV hariç, ve
 * atölye iskontosu UYGULANMIŞ hâlidir (`displayPriceKurus`) — kaleme yazılan
 * tutarla birebir aynı (bkz. bakimx-item.ts). Liste fiyatını (`workshopPriceKurus`)
 * burada basmayın: iskontolu atölye ekranda bir tutar görüp kalemde başkasını
 * bulur. Üstü çizili liste fiyatı da göstermiyoruz (BAK-47 kararı); iskonto varsa
 * yalnız küçük bir not çıkar.
 *
 * Etiketi ("Alış") satırdan kaldırmayın: aynı listede TecDoc parçalarının fiyatı
 * yok ve rakam satış fiyatı sanılırsa atölye kendi zammını unutur.
 */
export function BakimxProductRow({
  product,
  onSelect,
}: {
  product: BakimxProductSummary
  onSelect: () => void
}) {
  const outOfStock = product.stockQty <= 0 && !product.backorderable
  // İskontosuz atölyede boş string döner → satır bugünküyle birebir aynı kalır.
  const discountNote = formatDiscountLabel(product.discountBps)
  return (
    <div className="flex items-center border-b border-border/60 hover:bg-muted">
      <button
        type="button"
        onClick={onSelect}
        className="min-h-11 flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
      >
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
            <Store className="size-4 text-primary" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-foreground truncate">{product.name}</span>
          <span className="block text-xs text-muted-foreground truncate">
            <span className="font-mono">{product.sku}</span>
            {product.brandName && <> · {product.brandName}</>}
            {product.categoryLabel && <> · {product.categoryLabel}</>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
            <span className="font-semibold tabular-nums text-foreground">
              Alış: {formatTRY(product.displayPriceKurus)}
            </span>
            <span className="text-muted-foreground/70">KDV hariç</span>
            <span className={cn(outOfStock ? "text-warning-strong" : "text-muted-foreground")}>
              · {bakimxStockLabel(product)}
            </span>
            {discountNote && <span className="text-success-strong">· {discountNote}</span>}
          </span>
        </span>
      </button>
    </div>
  )
}
