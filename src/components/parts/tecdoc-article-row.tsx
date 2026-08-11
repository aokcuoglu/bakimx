"use client"

import { Info, PackageSearch } from "lucide-react"
import type { ArticleSummary } from "@/lib/tecdoc/types"

/**
 * Parça seçicideki tek parça satırı — hem kategori drill-down listesi hem arama
 * sonuçları bunu kullanır.
 *
 * Satır bir div: seçim butonu ile ⓘ butonu KARDEŞ olmalı (iç içe buton geçersiz
 * HTML). `context` verilirse üçüncü satırda küçük bir bağlam etiketi çıkar
 * (aramada parçanın hangi kategoriden geldiğini gösterir). `matchedOems` doluysa
 * satır neden çıktığı görünsün diye eşleşen OEM numarası da yazılır (#312).
 */
export function TecdocArticleRow({
  article,
  context,
  matchedOems,
  onSelect,
  onShowDetail,
}: {
  article: ArticleSummary
  context?: string | null
  /** Sorguyla eşleşen OEM numaraları (aramada gelir; drill-down listesinde boş). */
  matchedOems?: string[]
  onSelect: () => void
  onShowDetail?: (a: ArticleSummary) => void
}) {
  return (
    <div className="flex items-center border-b border-border/60 hover:bg-muted">
      <button
        type="button"
        onClick={onSelect}
        className="min-h-11 flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
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
          <span className="block text-sm text-foreground truncate">{article.productName}</span>
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
            <span className="block text-[11px] text-muted-foreground/70 truncate">{context}</span>
          )}
        </span>
      </button>
      {onShowDetail && (
        <button
          type="button"
          aria-label="Parça detayı"
          title="Özellikler, görsel ve uygunluk"
          onClick={() => onShowDetail(article)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <Info className="size-4" />
        </button>
      )}
    </div>
  )
}
