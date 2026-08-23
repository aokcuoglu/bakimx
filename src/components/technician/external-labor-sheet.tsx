"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      {open && <ExternalLaborSheet orderId={orderId} open onOpenChange={setOpen} />}
    </>
  )
}

function ExternalLaborSheet({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("")
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
    fd.set("serviceOrderId", orderId)
    fd.set("type", "external_labor")
    fd.set("name", name.trim())
    fd.set("quantity", "1")
    fd.set("source", "manual")
    fd.set("includeVat", "false")
    const priceKurus = price.trim() ? parseTRYToKurus(price) : null
    if (priceKurus != null) fd.set("unitPrice", String(priceKurus))
    if (supplierName.trim()) fd.set("supplierName", supplierName.trim())
    if (note.trim()) fd.set("note", note.trim())

    setSubmitting(true)
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Kaydedilemedi")
        return
      }
      close()
      toast.success("Dış işçilik eklendi")
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
          <DialogTitle>Dış İşçilik Ekle</DialogTitle>
          <DialogDescription>Araca dışarıda yaptırdığın işi iş emrine kalem olarak ekle; tutarı toplama işlenir.</DialogDescription>
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
              {submitting ? "Kaydediliyor…" : "Kalem Olarak Ekle"}
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
