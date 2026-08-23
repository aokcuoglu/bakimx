"use client"

import { Info, PackageSearch } from "lucide-react"
import type { ArticleSummary } from "@/lib/tecdoc/types"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"
import { formatTRY } from "@/lib/format"
import { bakimxStockLabel } from "@/lib/parts/bakimx-item"
import { formatDiscountLabel } from "@/lib/parts/bakimx-price"
import { GetirbakimProductRow } from "./getirbakim-product-row"

export const TECDOC_SOURCE_LABEL = "TecDoc"

/**
 * Parça seçicideki tek parça satırı — hem kategori drill-down listesi hem arama
 * sonuçları bunu kullanır.
 *
 * Satır bir div: seçim butonu ile ⓘ butonu KARDEŞ olmalı (iç içe buton geçersiz
 * HTML). `context` verilirse üçüncü satırda küçük bir bağlam etiketi çıkar
 * (aramada parçanın hangi kategoriden geldiğini gösterir). `matchedOems` doluysa
 * satır neden çıktığı görünsün diye eşleşen OEM numarası da yazılır (#312).
 * `bakimxMatch` varsa, BakımX fiyat ve stok bilgisi rozet olarak gösterilir (Faz 2).
 * Rozetteki tutar atölye iskontosu uygulanmış alış fiyatıdır (`displayPriceKurus`),
 * yani BakımX ürün satırının ve kaleme yazılan tutarın aynısı; liste fiyatı
 * (`workshopPriceKurus`) atölye yüzeyine çıkmaz (BAK-47 / BAK-58).
 *
 * `getirbakimMatches` TecDoc makalesine OEM/parça no ile bağlanan GetirBakım
 * teklifleridir — üst satır TecDoc kalemi, yuva GetirBakım kalemi ekler.
 */
export function TecdocArticleRow({
  article,
  context,
  matchedOems,
  bakimxMatch,
  getirbakimMatches,
  onSelect,
  onGetirbakimSelect,
  onShowDetail,
}: {
  article: ArticleSummary
  context?: string | null
  /** Sorguyla eşleşen OEM numaraları (aramada gelir; drill-down listesinde boş). */
  matchedOems?: string[]
  /** BakımX eşleşmesi varsa fiyat rozeti (Faz 2). */
  bakimxMatch?: BakimxProductSummary | null
  getirbakimMatches?: GetirbakimProduct[]
  onSelect: () => void
  onGetirbakimSelect?: (product: GetirbakimProduct) => void
  onShowDetail?: (a: ArticleSummary) => void
}) {
  // İskontosuz atölyede boş string → rozet bugünküyle birebir aynı kalır.
  const discountNote = bakimxMatch ? formatDiscountLabel(bakimxMatch.discountBps) : ""
  const nested = getirbakimMatches ?? []
  return (
    <div>
      <div className="flex items-center border-b border-border/60 hover:bg-muted">
        <button
          type="button"
          onClick={onSelect}
          className="min-h-8 flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
        >
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded object-contain bg-white border border-border/60"
            />
          ) : (
            <span className="size-10 shrink-0 rounded bg-muted flex items-center justify-center">
              <PackageSearch className="size-4 text-muted-foreground/50" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{article.productName}</span>
              <span className="shrink-0 rounded-sm border border-border bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {TECDOC_SOURCE_LABEL}
              </span>
            </span>
            <span className="block text-xs text-muted-foreground truncate">
              <span className="font-mono">{article.articleNo}</span>
              {article.supplierName && <> · {article.supplierName}</>}
            </span>
            {matchedOems && matchedOems.length > 0 && (
              <span className="block text-[11px] text-muted-foreground truncate">
                OEM: <span className="font-mono">{matchedOems.join(", ")}</span>
              </span>
            )}
            {context && (
              <span className="block text-[11px] text-muted-foreground truncate">{context}</span>
            )}
            {bakimxMatch && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                <span className="font-semibold tabular-nums text-foreground">
                  {formatTRY(bakimxMatch.displayPriceKurus)}
                </span>
                <span className="text-muted-foreground">KDV hariç</span>
                <span className="text-muted-foreground">· {bakimxStockLabel(bakimxMatch)}</span>
                {discountNote && <span className="text-success-strong">· {discountNote}</span>}
              </span>
            )}
          </span>
        </button>
        {onShowDetail && (
          <button
            type="button"
            aria-label="Parça detayı"
            title="Özellikler, görsel ve uygunluk"
            onClick={() => onShowDetail(article)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <Info className="size-4" />
          </button>
        )}
      </div>
      {nested.map((product) => (
        <GetirbakimProductRow
          key={`gb-nested-${article.tecdocArticleId}-${product.id}`}
          product={product}
          nested
          onSelect={onGetirbakimSelect ? () => onGetirbakimSelect(product) : undefined}
        />
      ))}
    </div>
  )
}
