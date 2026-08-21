"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Clock3, Package, Store } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatTRY } from "@/lib/format"
import type { GetirbakimExactProduct, GetirbakimOffer } from "@/lib/parts/getirbakim/types"

type PartInfo = { name: string; sku?: string | null; brand?: string | null }
type OfferResponse =
  | { status: "matched" | "no_offers"; normalizedPartNo: string; products: GetirbakimExactProduct[] }
  | { status: "no_match" | "upstream_error"; normalizedPartNo: string }
type SelectedOffer = { product: GetirbakimExactProduct; offer: GetirbakimOffer }
type Quote = { bindingNetKurus: number; bindingVatKurus: number; bindingGrossKurus: number; unitNetKurus: number; currency: string; policyVersion: string; expiresAt: string; confirmationToken: string }

const RECONFIRMATION_REQUIRED_CODES = new Set(["PRICE_CHANGED", "QUOTE_CHANGED", "QUOTE_EXPIRED"])

export function SupplierPriceDialog({ open, onOpenChange, part, orderId, orderItemId, quantity }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  part: PartInfo
  orderId?: string
  orderItemId?: string
  quantity?: number
}) {
  const router = useRouter()
  const [request, setRequest] = useState<{ partNo: string; result: OfferResponse } | null>(null)
  const [selected, setSelected] = useState<SelectedOffer | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmationChanged, setConfirmationChanged] = useState(false)
  const partNo = part.sku?.trim() ?? ""
  const purchaseQuantity = quantity ?? 1

  useEffect(() => {
    if (!open || !partNo) return
    const controller = new AbortController()
    void fetch(`/api/catalog/getirbakim/offers?partNo=${encodeURIComponent(partNo)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as OfferResponse
        setRequest({
          partNo,
          result: response.ok ? data : { status: "upstream_error", normalizedPartNo: partNo },
        })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        setRequest({ partNo, result: { status: "upstream_error", normalizedPartNo: partNo } })
      })
    return () => controller.abort()
  }, [open, partNo])

  async function chooseOffer(product: GetirbakimExactProduct, offer: GetirbakimOffer) {
    setSelected({ product, offer }); setQuote(null); setConfirmationChanged(false); setPending(true)
    try {
      const response = await fetch("/api/orders/external-procurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "quote", selectedOfferId: offer.selectedOfferId, quantity: purchaseQuantity }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Bağlayıcı fiyat alınamadı.")
      setQuote(data.quote)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Bağlayıcı fiyat alınamadı.") }
    finally { setPending(false) }
  }

  async function confirmPurchase() {
    if (!selected || !quote || !orderId || !orderItemId) return
    setPending(true)
    try {
      const response = await fetch("/api/orders/external-procurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        action: "purchase", orderId, orderItemId, idempotencyKey: crypto.randomUUID(),
        externalProductId: selected.product.sourceProductId, selectedOfferId: selected.offer.selectedOfferId,
        quantity: purchaseQuantity, expectedUnitNetKurus: quote.unitNetKurus,
        confirmationToken: quote.confirmationToken,
        productPresentation: { name: part.name, brand: selected.product.brandName, partNumber: selected.product.manufacturerPartNumber.value },
        informationalSnapshot: { unitPriceKurus: selected.offer.informationalPriceKurus ?? undefined, currency: selected.offer.currency, availability: selected.offer.availability, capturedAt: new Date().toISOString() },
      }) })
      const data = await response.json()
      if (!response.ok) {
        if (RECONFIRMATION_REQUIRED_CODES.has(data.code)) {
          setQuote(null)
          await chooseOffer(selected.product, selected.offer)
          setConfirmationChanged(true)
          return
        }
        throw new Error(data.error || "Satın alma talebi oluşturulamadı.")
      }
      toast.success("Satın alma talebi oluşturuldu; tedarik bekleniyor.")
      onOpenChange(false); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Satın alma talebi oluşturulamadı.") }
    finally { setPending(false) }
  }

  const result: OfferResponse | null = !partNo
    ? { status: "no_match", normalizedPartNo: "" }
    : request?.partNo === partNo
      ? request.result
      : null
  const loading = !!partNo && result == null
  const products = result?.status === "matched" ? result.products : []
  const offerCount = products.reduce((count, product) => count + product.offers.length, 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b p-4 pr-10">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Store className="size-4 shrink-0 text-primary" /><span className="truncate">Tedarikçi fiyatları</span>
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            <span className="font-medium text-foreground">{part.name || "Parça"}</span>
            {part.sku ? <span className="text-muted-foreground"> · {part.sku}</span> : null}
            {!loading && result?.status === "matched" ? <span className="text-muted-foreground"> · {offerCount} teklif</span> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
          {loading ? <StateMessage>Gerçek tedarikçi teklifleri yükleniyor…</StateMessage> : null}
          {!loading && result?.status === "no_match" ? <StateMessage>Bu parça numarasıyla eşleşen GetirBakım ürünü bulunamadı.</StateMessage> : null}
          {!loading && result?.status === "no_offers" ? <StateMessage>Ürün eşleşti ancak aktif tedarikçi teklifi bulunmuyor.</StateMessage> : null}
          {!loading && result?.status === "upstream_error" ? <StateMessage error>Teklifler şu anda alınamıyor. Daha sonra yeniden deneyin.</StateMessage> : null}
          {products.map((product) => (
            <section key={product.sourceProductId} className="space-y-2" aria-label={`${product.brandName || "Markasız"} teklifleri`}>
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{product.brandName || "Marka belirtilmemiş"}</span>
                <span>· {product.manufacturerPartNumber.value}</span>
              </div>
              {product.offers.map((offer, index) => (
                <OfferCard key={`${product.sourceProductId}:${offer.selectedOfferId}:${index}`} offer={offer} selected={selected?.offer.selectedOfferId === offer.selectedOfferId} disabled={pending} onSelect={() => void chooseOffer(product, offer)} />
              ))}
            </section>
          ))}
        </div>
        {confirmationChanged ? <Alert className="mx-3 mb-3" variant="destructive"><AlertTitle>Bağlayıcı teklif yenilendi</AlertTitle><AlertDescription>Fiyat, politika veya teklif geçerliliği değişti. Yeni bağlayıcı özeti kontrol edip yeniden açıkça onaylayın. Önceki onayınız kullanılmadı.</AlertDescription></Alert> : null}
        {selected && quote ? <div className="space-y-3 border-t p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Bağlayıcı toplam</p><p className="text-xs text-muted-foreground">KDV dahil · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(quote.expiresAt))} tarihine kadar · Politika {quote.policyVersion}</p></div><p className="text-lg font-semibold tabular-nums">{formatTRY(quote.bindingGrossKurus)}</p></div>
          {orderId && orderItemId ? <Button className="w-full" disabled={pending} onClick={() => void confirmPurchase()}>{pending ? "İşleniyor…" : "Bu fiyatla satın almayı onayla"}</Button> : <p className="text-xs text-muted-foreground">Satın alma yalnız iş emri kaleminden başlatılabilir.</p>}
        </div> : null}
        <div className="border-t bg-muted/40 px-4 py-2.5">
          <p className="text-[11px] leading-tight text-muted-foreground">Fiyatlar KDV hariç, bilgilendirme amaçlıdır ve bağlayıcı teklif değildir.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StateMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`flex min-h-28 items-center justify-center gap-2 rounded-lg border p-4 text-center text-sm ${error ? "text-destructive-strong" : "text-muted-foreground"}`}>{error ? <AlertCircle className="size-4 shrink-0" /> : null}{children}</div>
}

export function supplierAvailabilityLabel(offer: GetirbakimOffer): string {
  if (offer.availability === "IN_STOCK") return offer.stockQty == null ? "Stokta" : `Stokta · ${offer.stockQty} adet`
  if (offer.availability === "SUPPLYABLE") return "Tedarik edilebilir"
  return "Stok bilgisi yok"
}

function OfferCard({ offer, selected, disabled, onSelect }: { offer: GetirbakimOffer; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const date = offer.lastSyncedAt ? new Date(offer.lastSyncedAt) : null
  const synced = date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(date)
    : null
  return (
    <div className={`rounded-lg border bg-card p-3 ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <span className="block truncate text-sm font-medium text-foreground">{offer.supplierDisplayName}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Package className="size-3" />{supplierAvailabilityLabel(offer)}</span>
            {synced ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />Son güncelleme: {synced}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-base font-semibold tabular-nums text-foreground">{offer.informationalPriceKurus == null ? "Fiyat sorunuz" : formatTRY(offer.informationalPriceKurus)}</span>
          <Badge variant="outline">Bilgilendirme</Badge>
        </div>
      </div>
      <Button type="button" variant={selected ? "secondary" : "outline"} size="sm" className="mt-3 w-full" disabled={disabled || offer.informationalPriceKurus == null} onClick={onSelect}>{selected ? "Seçildi" : "Teklifi seç"}</Button>
    </div>
  )
}
