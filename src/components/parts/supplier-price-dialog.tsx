"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import {
  getMockSupplierPrices,
  type SupplierOffer,
} from "@/lib/tecdoc/mock-supplier-prices"
import { Check, Package, Store, Truck } from "lucide-react"

type PartInfo = { name: string; sku?: string | null; brand?: string | null }

export function SupplierPriceDialog({
  open,
  onOpenChange,
  part,
  editable,
  onApply,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  part: PartInfo
  editable: boolean
  onApply: (priceKurus: number) => void
}) {
  // Deterministik: aynı parça → aynı teklifler. `open` iken hesapla, girdi
  // değişmedikçe yeniden üretme.
  const result = useMemo(
    () => getMockSupplierPrices(part),
    [part.sku, part.name, part.brand] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0">
        <DialogHeader className="gap-1 border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Store className="size-4 shrink-0 text-primary" />
            <span className="truncate">Tedarikçi fiyatları</span>
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            <span className="font-medium text-foreground">{part.name || "Parça"}</span>
            {part.sku ? <span className="text-muted-foreground"> · {part.sku}</span> : null}
            <span className="text-muted-foreground"> · {result.offers.length} tedarikçi</span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
          {result.offers.map((offer, idx) => (
            <OfferCard
              key={offer.supplierName}
              offer={offer}
              cheapest={idx === result.cheapestIndex}
              editable={editable}
              onApply={() => {
                onApply(offer.priceKurus)
                onOpenChange(false)
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5">
          <p className="text-[11px] leading-tight text-muted-foreground">
            Örnek fiyatlar — demo. Gerçek tedarikçi entegrasyonu yakında.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StockIndicator({ offer }: { offer: SupplierOffer }) {
  if (offer.stock === "in_stock") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" /> Stokta
      </span>
    )
  }
  if (offer.stock === "low_stock") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" /> Son {offer.stockQty} adet
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" /> Tedarik edilebilir
    </span>
  )
}

function OfferCard({
  offer,
  cheapest,
  editable,
  onApply,
}: {
  offer: SupplierOffer
  cheapest: boolean
  editable: boolean
  onApply: () => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        cheapest ? "border-emerald-500/60 bg-emerald-500/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Sol: tedarikçi + marka + parça no */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{offer.supplierName}</span>
            {cheapest && (
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">En uygun</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={offer.brandKind === "oem" ? "secondary" : "outline"}>
              {offer.brandName}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <Package className="size-3" /> {offer.articleNo}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <StockIndicator offer={offer} />
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Truck className="size-3" /> {offer.deliveryLabel}
            </span>
          </div>
        </div>

        {/* Sağ: fiyat + uygula */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn("text-base font-semibold tabular-nums", cheapest ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
            {formatTRY(offer.priceKurus)}
          </span>
          {editable && (
            <Button type="button" size="sm" variant={cheapest ? "default" : "outline"} onClick={onApply} className="gap-1">
              <Check className="size-3.5" /> Bu fiyatı kullan
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
