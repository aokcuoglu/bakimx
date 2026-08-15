"use client"

import { useState } from "react"
import { Loader2, ShoppingCart, Store } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatTRY } from "@/lib/format"
import { bakimxStockLabel } from "@/lib/parts/bakimx-item"
import { createBakimxOrder } from "@/lib/parts/bakimx-client"
import { formatDiscountLabel } from "@/lib/parts/bakimx-price"
import { BAKIMX_ORDER_MAX_QUANTITY } from "@/lib/validations/bakimx-order"
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
 *
 * İKİ AYRI EYLEM (BAK-60) — karıştırılmamalı:
 *  • Satıra tıklamak (`onSelect`) ürünü İŞ EMRİNE KALEM olarak ekler. Sipariş
 *    oluşturmaz, stoğa dokunmaz; bugünkü davranış aynen korunur.
 *  • "Sipariş ver" BakımX'ten mal ister. Atölye bir parçayı teklife koyup işi
 *    almayabilir, o yüzden kalem eklemek talep sayılmaz — talep açık bir eylemdir.
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

  const [orderOpen, setOrderOpen] = useState(false)
  const [quantity, setQuantity] = useState("1")
  const [pending, setPending] = useState(false)

  async function submitOrder() {
    const parsed = Number(quantity)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > BAKIMX_ORDER_MAX_QUANTITY) {
      toast.error("Geçerli bir adet girin.")
      return
    }
    setPending(true)
    // Fiyat GÖNDERİLMEZ: tutarı sunucu atölyenin iskontosuyla kendisi çözer.
    const result = await createBakimxOrder({
      items: [{ bakimxProductId: product.id, quantity: parsed }],
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Sipariş talebi oluşturuldu: ${parsed} ${product.unit} ${product.name}`)
    setOrderOpen(false)
    setQuantity("1")
  }

  return (
    <div className="border-b border-border/60">
      <div className="flex items-center hover:bg-muted">
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
        <Button
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => setOrderOpen((open) => !open)}
          aria-expanded={orderOpen}
          // Etiket dar ekranda gizleniyor; erişilebilir ad `aria-label` ile
          // KALIYOR — aksi hâlde mobilde düğme ekran okuyucuya isimsiz görünür.
          aria-label="Sipariş ver"
          className="mr-2 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ShoppingCart className="size-3.5" />
          <span className="hidden sm:inline">Sipariş ver</span>
        </Button>
      </div>

      {orderOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-2">
          <label htmlFor={`bakimx-order-qty-${product.id}`} className="text-xs text-muted-foreground">
            Adet
          </label>
          <Input
            id={`bakimx-order-qty-${product.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={BAKIMX_ORDER_MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">{product.unit}</span>
          <Button type="button" size="compact" onClick={submitOrder} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Talep gönder
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => setOrderOpen(false)}
            disabled={pending}
          >
            Vazgeç
          </Button>
          {/* Talep ≠ kalem: aynı satırdaki iki eylemin karıştırılmaması için yazılı. */}
          <span className="basis-full text-[11px] text-muted-foreground">
            Talep BakımX&apos;e gider; iş emrine kalem eklemez.
          </span>
        </div>
      )}
    </div>
  )
}
