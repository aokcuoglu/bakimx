"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Plus, Minus, Loader2 } from "lucide-react"
import { PartAttributeField } from "@/components/parts/part-attribute-field"
import { liraToKurus } from "@/lib/money"

export type ManualPartDraft = {
  name: string
  brand: string | null
  category: string | null
  categoryId: number | null
  quantity: number
  unitPrice: number | null // kuruş
}

/**
 * "Oluştur & Düzenle" modalı: birleşik parça arama kutusundan açılır. Yazılan
 * metni ön-doldurur; marka/kategori/miktar/birim fiyatı odaklı bir formda
 * toplayıp onSubmit ile üst bileşene (addItem) verir. Manuel parça = source
 * "manual" (üst bileşen atar). PartAttributeField, üstteki PartAttrOptionsProvider
 * bağlamına (React portal bağlamı korunur) güvenir.
 */
export function ManualPartDialog({
  open,
  onOpenChange,
  initialName,
  vehicleTypeId,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  initialName: string
  vehicleTypeId: number | null
  submitting: boolean
  onSubmit: (d: ManualPartDraft) => void
}) {
  const [name, setName] = useState(initialName)
  // Marka/Kategori serbest metni: yazılan metin (henüz commit edilmemiş de olsa)
  // doğrudan kaydedilsin diye alanın kendi metnini izleriz. Katalog önerisi
  // seçilirse kategoriId + seçilen etiket saklanır; metin etikettten sapınca id düşer.
  const [brandText, setBrandText] = useState("")
  const [categoryText, setCategoryText] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categorySelLabel, setCategorySelLabel] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceDraft, setPriceDraft] = useState("")

  // Her açılışta formu ön-dolu ad ile temiz başlat.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta formu ön-dolu ad ile sıfırla
    setName(initialName)
    setBrandText("")
    setCategoryText("")
    setCategoryId(null)
    setCategorySelLabel(null)
    setQuantity(1)
    setPriceDraft("")
  }, [open, initialName])

  function submit() {
    if (!name.trim() || submitting) return
    const lira = Number(priceDraft)
    const unitPrice = priceDraft && !Number.isNaN(lira) && lira >= 0 ? liraToKurus(lira) : null
    const brand = brandText.trim() || null
    const category = categoryText.trim() || null
    // categoryId yalnız metin, seçilen katalog etiketiyle hâlâ birebir eşleşiyorsa geçerli.
    const finalCategoryId = category && category === categorySelLabel ? categoryId : null
    onSubmit({ name: name.trim(), brand, category, categoryId: finalCategoryId, quantity, unitPrice })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Parça</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Parça adı</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Parça adı (ör. ön fren balatası)"
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Marka</span>
              <PartAttributeField
                kind="brand"
                vehicleTypeId={vehicleTypeId}
                value={brandText}
                onSelect={(_id, n) => setBrandText(n)}
                onCommitFreeText={(v) => setBrandText(v)}
                onClear={() => setBrandText("")}
                onQueryChange={setBrandText}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kategori</span>
              <PartAttributeField
                kind="category"
                vehicleTypeId={vehicleTypeId}
                value={categoryText}
                onSelect={(id, n) => { setCategoryText(n); setCategoryId(id); setCategorySelLabel(n) }}
                onCommitFreeText={(v) => { setCategoryText(v); setCategoryId(null); setCategorySelLabel(null) }}
                onClear={() => { setCategoryText(""); setCategoryId(null); setCategorySelLabel(null) }}
                onQueryChange={setCategoryText}
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Miktar</span>
              <div className="inline-flex h-9 items-center rounded-lg border border-input bg-background">
                <Button type="button" variant="ghost" size="icon-xs" className="rounded-r-none"
                  aria-label="Azalt" disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus />
                </Button>
                <span className="min-w-6 px-1 text-center text-xs font-medium tabular-nums">{quantity}</span>
                <Button type="button" variant="ghost" size="icon-xs" className="rounded-l-none"
                  aria-label="Arttır" onClick={() => setQuantity((q) => q + 1)}>
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Birim Fiyat</span>
              <InputGroup className="h-9 w-32">
                <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Fiyat"
                  className="text-sm tabular-nums"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
