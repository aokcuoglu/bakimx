"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { parseTRYToKurus } from "@/lib/money"

/**
 * "Dış İşçilik Ekle" — teknisyenin araca dışarıda yaptırdığı işçiliği (rot
 * balansı, kaportacı vb.) DOĞRUDAN iş emri kalemi olarak ekler.
 *
 * "Talepler" akışının yerine geçti: talep açıp ofisin kaleme çevirmesi yok,
 * kalem anında oluşur ve tutarı iş emri toplamına işlenir. Sunucu kapısı,
 * işçilik composer'ıyla AYNI `/api/orders/items` POST'u — tip
 * `external_labor`, miktar 1, kaynak `manual`, satır KDV'si kapalı (grid'in
 * boş taslağıyla aynı varsayımlar). Firma ("nerede yaptırıldı") opsiyoneldir
 * ve `supplierName` kolonuna yazılır; parça/işçilik satırlarında bu alan boş
 * kalır (bkz. addOrderItemAction).
 */
export function AddExternalLaborButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Dış İşçilik
      </Button>
      {open && <ExternalLaborSheet orderId={orderId} item={null} open onOpenChange={setOpen} />}
    </>
  )
}

export type ExternalLaborFormItem = {
  id: string
  name: string
  supplierName: string | null
  unitPrice: number | null
  note: string | null
  purchasedAt: string | null
  createdAt: string
}

function todayTrString(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`
}

function isoToTr(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`
}

/** Kart üzerindeki kalem simgesi — dış işçilik kaydını düzenler. */
export function EditExternalLaborButton({ orderId, item }: { orderId: string; item: ExternalLaborFormItem }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`${item.name} — dış işçilik kaydını düzenle`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
      </Button>
      {open && <ExternalLaborSheet orderId={orderId} item={item} open onOpenChange={setOpen} />}
    </>
  )
}

function ExternalLaborSheet({
  orderId,
  item,
  open,
  onOpenChange,
}: {
  orderId: string
  item: ExternalLaborFormItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const editing = item != null
  const [name, setName] = useState(item?.name ?? "")
  const [supplierName, setSupplierName] = useState(item?.supplierName ?? "")
  const [price, setPrice] = useState(item?.unitPrice != null ? String(item.unitPrice / 100) : "")
  const [note, setNote] = useState(item?.note ?? "")
  const [purchasedAt, setPurchasedAt] = useState(item ? isoToTr(item.purchasedAt ?? item.createdAt) : todayTrString())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function close() {
    onOpenChange(false)
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) {
      setError("İşçilik adı zorunludur")
      return
    }
    if (price.trim() && parseTRYToKurus(price) == null) {
      setError("Geçerli bir tutar giriniz")
      return
    }

    // Grid'in boş dış-işçilik taslağıyla aynı sözleşme: miktar 1, KDV'siz,
    // manuel kaynak. Tutar NET yazılır (kuruş); boşsa sunucu null bırakır.
    const fd = new FormData()
    fd.set("name", name.trim())
    const priceKurus = price.trim() ? parseTRYToKurus(price) : null
    if (priceKurus != null) fd.set("unitPrice", String(priceKurus))
    fd.set("supplierName", supplierName.trim())
    fd.set("note", note.trim())
    fd.set("purchasedAt", purchasedAt)
    if (!editing) {
      fd.set("serviceOrderId", orderId)
      fd.set("type", "external_labor")
      fd.set("quantity", "1")
      fd.set("source", "manual")
      fd.set("includeVat", "false")
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        editing ? `/api/orders/items?id=${item.id}&orderId=${orderId}` : "/api/orders/items",
        { method: editing ? "PATCH" : "POST", body: fd },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Kaydedilemedi")
        return
      }
      close()
      toast.success(editing ? "Dış işçilik güncellendi" : "Dış işçilik eklendi")
      router.refresh()
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Dış İşçiliği Düzenle" : "Dış İşçilik Ekle"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Dışarıda yaptırılan işin bilgilerini güncelle. Tutar iş emri toplamına işlenir."
              : "Araca dışarıda yaptırdığın işi iş emrine kalem olarak ekle; tutarı toplama işlenir."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="text-sm text-destructive-strong bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="external-labor-name" className="text-xs font-medium text-muted-foreground">
              İşçilik *
            </label>
            <Input
              id="external-labor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Ör. Rot balans ayarı"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="external-labor-supplier" className="text-xs font-medium text-muted-foreground">
              Nerede yaptırıldı
            </label>
            <Input
              id="external-labor-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              maxLength={160}
              placeholder="Firma (opsiyonel)"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="external-labor-price" className="text-xs font-medium text-muted-foreground">
              Tutar (₺)
            </label>
            {/* inputMode="decimal": mobil klavyede virgül/nokta çıkar. Türkçe
                "1.250,50" biçimi parseTRYToKurus ile çevrilir. */}
            <Input
              id="external-labor-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              maxLength={20}
              placeholder="0,00"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tarih</label>
            <DatePicker value={purchasedAt} onChange={setPurchasedAt} disabled={submitting} />
          </div>

          <div className="space-y-1">
            <label htmlFor="external-labor-note" className="text-xs font-medium text-muted-foreground">
              Not
            </label>
            <Input
              id="external-labor-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Ör. ön takım, fişi alındı (opsiyonel)"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              className="flex-1 touch-manipulation"
              disabled={submitting || !name.trim()}
              onClick={handleSubmit}
            >
              <Send className="size-3.5" />
              {submitting ? "Kaydediliyor…" : editing ? "Değişiklikleri Kaydet" : "Kalem Olarak Ekle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="touch-manipulation"
              disabled={submitting}
              onClick={close}
            >
              İptal
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
