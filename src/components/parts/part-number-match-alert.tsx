"use client"

import { Loader2, PackageSearch, Store, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  purchaseMatchKey,
  purchaseMatchNote,
  type PurchaseMatch,
} from "@/lib/parts/purchase-match"

/**
 * "Bu parça numarası zaten katalogda var" uyarısı (BAK-84).
 *
 * Dışarıdan alınan bir parçanın numarası araç kataloğunda, BakımX kataloğunda ya
 * da atölyenin stok kartlarında birebir çıktığında gösterilir. Amaç ENGELLEMEK
 * değil BİLDİRMEK: usta eşleştirebilir (kalem katalog bağıyla kaydedilir) ya da
 * yok sayıp elle girmeye devam edebilir — uyarı kapatılabilir bir öneri kutusudur.
 */
export function PartNumberMatchAlert({
  matches,
  searching,
  onApply,
  onDismiss,
}: {
  matches: PurchaseMatch[]
  searching: boolean
  onApply: (match: PurchaseMatch) => void
  onDismiss: () => void
}) {
  if (searching && matches.length === 0) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Parça numarası katalogda aranıyor…
      </p>
    )
  }
  if (matches.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-warning-strong">
          <TriangleAlert className="size-3.5 shrink-0" />
          Bu parça numarası kayıtlı katalogda bulundu
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="-my-1 h-7 shrink-0 text-xs text-muted-foreground"
        >
          Yok say
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Eşleştirirsen parça adı, markası ve katalog bağı kalemle birlikte kaydedilir.
      </p>

      <div className="space-y-1.5">
        {matches.map((match) => (
          <MatchRow key={purchaseMatchKey(match)} match={match} onApply={() => onApply(match)} />
        ))}
      </div>
    </div>
  )
}

function MatchRow({ match, onApply }: { match: PurchaseMatch; onApply: () => void }) {
  const { name, partNo, brand, imageUrl } = matchSummary(match)
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background p-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="size-9 shrink-0 rounded object-contain bg-white border border-border/60"
        />
      ) : (
        <span className="size-9 shrink-0 rounded bg-muted flex items-center justify-center">
          {match.kind === "bakimx" ? (
            <Store className="size-4 text-primary" />
          ) : (
            <PackageSearch className="size-4 text-muted-foreground/50" />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground break-words">{name}</p>
        <p className="text-xs text-muted-foreground break-words">
          <span className="font-mono">{partNo}</span>
          {brand && <> · {brand}</>}
        </p>
        <p className="text-[11px] text-muted-foreground">{purchaseMatchNote(match)}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onApply} className="shrink-0 touch-manipulation">
        Eşleştir
      </Button>
    </div>
  )
}

function matchSummary(match: PurchaseMatch): {
  name: string
  partNo: string
  brand: string
  imageUrl: string | null
} {
  if (match.kind === "catalog") {
    const a = match.article
    return { name: a.productName, partNo: a.articleNo, brand: a.supplierName || "", imageUrl: a.imageUrl }
  }
  if (match.kind === "bakimx") {
    const p = match.product
    return { name: p.name, partNo: p.sku, brand: p.brandName || "", imageUrl: p.imageUrl }
  }
  const p = match.part
  return { name: p.name, partNo: p.sku || p.oemNo || "", brand: p.brand || "", imageUrl: null }
}
