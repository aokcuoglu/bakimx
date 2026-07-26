"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { formatTRY } from "@/lib/format"
import { parseTRYToKurus, kurusToLira } from "@/lib/money"
import { Camera, Pencil, Trash2, ShoppingCart } from "lucide-react"

export type PurchaseDetailItem = {
  id: string
  name: string
  sku: string | null
  quantity: number
  purchasePriceKurus: number | null
  supplierName: string | null
  purchasedAt: string | null
  purchasedByName: string | null
  purchasePhotoId: string | null
}

/** ISO tarih → dd.MM.yyyy (DatePicker depolama formatı). */
function isoToTr(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${d.getFullYear()}`
}

/** dd.MM.yyyy / ISO → tr-TR görüntü. */
function displayDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR")
}

/**
 * Dış alım (source=purchase) kaleminin detayını gösteren modal. Salt-görünür
 * (kilitli emir) veya düzenlenebilir. Düzenlemede tedarikçi/tarih/alış fiyatı ve
 * isteğe bağlı yeni parça-kutusu fotoğrafı PATCH edilir. Satış fiyatı (unitPrice)
 * buraya dahil DEĞİLDİR — grid'deki mevcut alandan bağımsız düzenlenir.
 */
export function PurchaseDetailDialog({
  open,
  onOpenChange,
  orderId,
  item,
  editable,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  item: PurchaseDetailItem
  editable: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [supplierName, setSupplierName] = useState(item.supplierName ?? "")
  const [purchasedAt, setPurchasedAt] = useState(isoToTr(item.purchasedAt))
  const [price, setPrice] = useState(
    item.purchasePriceKurus != null ? String(kurusToLira(item.purchasePriceKurus)) : "",
  )
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetEdit() {
    setEditing(false)
    setSupplierName(item.supplierName ?? "")
    setPurchasedAt(isoToTr(item.purchasedAt))
    setPrice(item.purchasePriceKurus != null ? String(kurusToLira(item.purchasePriceKurus)) : "")
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setError(null)
  }

  function onPickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  async function handleSave() {
    setError(null)
    const priceKurus = price.trim() ? parseTRYToKurus(price) : 0
    if (priceKurus == null) {
      setError("Geçerli bir alış fiyatı giriniz")
      return
    }
    const fd = new FormData()
    fd.set("purchasePriceKurus", String(priceKurus))
    fd.set("supplierName", supplierName.trim())
    // Masa düzenlemesi serbest metindir; eski Supplier bağını temizle ki
    // görüntülenen ad (supplierName) ile kayıtlı tedarikçi çelişmesin.
    fd.set("supplierId", "")
    fd.set("purchasedAt", purchasedAt)
    if (file) fd.set("file", file)

    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/purchases?id=${item.id}&orderId=${orderId}`, {
        method: "PATCH",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Güncellenemedi")
        setSubmitting(false)
        return
      }
      resetEdit()
      onOpenChange(false)
      router.refresh()
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetEdit()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" />
            Satın Alma Detayı
          </DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tedarikçi</label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Tedarikçi adı"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Alış fiyatı (₺)</label>
                <Input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Alış tarihi</label>
                <DatePicker value={purchasedAt} onChange={setPurchasedAt} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Parça kutusu fotoğrafı</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              {previewUrl ? (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Yeni foto" className="w-full max-h-48 object-contain rounded-lg border border-border bg-muted" />
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onPickFile(null)}>
                    <Trash2 className="size-3.5" />
                    Kaldır
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 py-5 text-sm text-muted-foreground"
                >
                  <Camera className="size-5" />
                  {item.purchasePhotoId ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <DetailRow label="Tedarikçi" value={item.supplierName || "—"} />
            <DetailRow
              label="Alış fiyatı"
              value={item.purchasePriceKurus != null ? formatTRY(item.purchasePriceKurus) : "—"}
            />
            <DetailRow label="Miktar" value={`${item.quantity} adet`} />
            <DetailRow label="Alış tarihi" value={displayDate(item.purchasedAt)} />
            <DetailRow label="Alan teknisyen" value={item.purchasedByName || "—"} />
            {item.sku && <DetailRow label="Parça no" value={item.sku} />}
            {item.purchasePhotoId && (
              <div className="pt-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Parça kutusu</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos?id=${item.purchasePhotoId}`}
                  alt="Parça kutusu"
                  className="w-full max-h-56 object-contain rounded-lg border border-border bg-muted"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={resetEdit} disabled={submitting}>
                Vazgeç
              </Button>
              <Button type="button" onClick={handleSave} disabled={submitting}>
                {submitting ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </>
          ) : editable ? (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Düzenle
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  )
}
