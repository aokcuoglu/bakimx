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
import { Switch } from "@/components/ui/switch"
import { Plus, Loader2 } from "lucide-react"
import { PartAttributeField } from "@/components/parts/part-attribute-field"
import { validateQuickPartDraft } from "@/lib/parts/quick-part-draft"
import { evaluateMoneyExpression } from "@/lib/money-expression"
import { isDivisibleOrderItemUnit, type OrderItemUnit } from "@/lib/orders/quantity"
import { OrderItemUnitCombobox } from "@/components/orders/order-item-unit-combobox"

export type ManualPartDraft = {
  name: string
  /** Stok kodu (SKU). Kalem satırına yazılır; kart açılıyorsa parçanın kodu olur. */
  sku: string | null
  brand: string | null
  category: string | null
  categoryId: number | null
  quantity: number
  unit: OrderItemUnit
  unitPrice: number | null // kuruş
  /** true → kalemin yanında kalıcı bir stok kartı (PartStockItem) da açılır. */
  createStockItem: boolean
}

/**
 * "Oluştur & Düzenle" modalı: birleşik parça arama kutusundan açılır. Yazılan
 * metni ön-doldurur; stok kodu/marka/kategori/miktar/birim fiyatı odaklı bir
 * formda toplayıp onSubmit ile üst bileşene (addItem) verir. Manuel parça =
 * source "manual" (üst bileşen atar). PartAttributeField, üstteki
 * PartAttrOptionsProvider bağlamına (React portal bağlamı korunur) güvenir.
 *
 * "Stok kartı olarak kaydet" açıkken (varsayılan) parça, kodu ile atölyenin
 * Stok / Parçalar listesine de yazılır (#210); kapatılırsa yalnız tek seferlik
 * kalem eklenir. Kartın açılması kalemi stoktan DÜŞMEZ — gerekçe için
 * createQuickPartAction'ın başlığına bakınız.
 *
 * onSubmit hata mesajı döndürürse (ör. kod zaten kullanılıyor) modal açık kalır
 * ve mesaj stok kodu alanının altında gösterilir; null dönerse üst bileşen
 * modalı kapatır.
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
  /** Hata mesajı döndürür (modal açık kalır) ya da başarıda null. */
  onSubmit: (d: ManualPartDraft) => Promise<string | null>
}) {
  const [name, setName] = useState(initialName)
  const [sku, setSku] = useState("")
  const [createStockItem, setCreateStockItem] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Marka/Kategori serbest metni: yazılan metin (henüz commit edilmemiş de olsa)
  // doğrudan kaydedilsin diye alanın kendi metnini izleriz. Katalog önerisi
  // seçilirse kategoriId + seçilen etiket saklanır; metin etikettten sapınca id düşer.
  const [brandText, setBrandText] = useState("")
  const [categoryText, setCategoryText] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categorySelLabel, setCategorySelLabel] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState<OrderItemUnit>("adet")
  const [priceDraft, setPriceDraft] = useState("")

  // Her açılışta formu ön-dolu ad ile temiz başlat.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta formu ön-dolu ad ile sıfırla
    setName(initialName)
    setSku("")
    setCreateStockItem(true)
    setError(null)
    setBrandText("")
    setCategoryText("")
    setCategoryId(null)
    setCategorySelLabel(null)
    setQuantity(1)
    setUnit("adet")
    setPriceDraft("")
  }, [open, initialName])

  async function submit() {
    if (submitting) return
    const validationError = validateQuickPartDraft({ name, sku, createStockItem })
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    const validQuantity = Number.isFinite(quantity) && quantity > 0 && quantity <= 999
      && Math.round(quantity * 1000) === quantity * 1000
      && (isDivisibleOrderItemUnit(unit) || Number.isInteger(quantity))
    if (!validQuantity) {
      setError(isDivisibleOrderItemUnit(unit) ? "Miktar en fazla 3 ondalık basamaklı olmalıdır" : "Bu birimde miktar tam sayı olmalıdır")
      return
    }
    // Yazılan tutar KDV HARİÇ (net) kabul edilir ve olduğu gibi saklanır
    // (BAK-75). KDV, satırın KDV tick'i açılırsa listede eklenir.
    const unitPrice = priceDraft ? evaluateMoneyExpression(priceDraft) : null
    if (priceDraft && unitPrice == null) {
      setError("Birim fiyat işlemi geçersiz")
      return
    }
    const brand = brandText.trim() || null
    const category = categoryText.trim() || null
    // categoryId yalnız metin, seçilen katalog etiketiyle hâlâ birebir eşleşiyorsa geçerli.
    const finalCategoryId = category && category === categorySelLabel ? categoryId : null
    const message = await onSubmit({
      name: name.trim(),
      sku: sku.trim() || null,
      brand,
      category,
      categoryId: finalCategoryId,
      quantity,
      unit,
      unitPrice,
      createStockItem,
    })
    if (message) setError(message)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Parça</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Kod|Ad ikilisi Yeni İşçilik modalıyla aynı hizada durur. Odak ada
              değil KODA verilir: ad arama kutusundan zaten ön-dolu gelir. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_1fr]">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">
                Stok kodu{createStockItem && <span className="text-destructive-strong"> *</span>}
              </span>
              <Input
                value={sku}
                onChange={(e) => { setSku(e.target.value); setError(null) }}
                placeholder="BLK-1234"
                className="text-sm"
                maxLength={60}
                aria-invalid={!!error}
                aria-describedby={error ? "manual-part-sku-error" : undefined}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Parça adı</span>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                placeholder="Parça adı (ör. ön fren balatası)"
                className="text-sm"
              />
            </div>
          </div>

          {error && (
            <p id="manual-part-sku-error" role="alert" className="text-xs text-destructive-strong">
              {error}
            </p>
          )}

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_8rem]">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Miktar</span>
              <Input type="number" inputMode="decimal" min="0.001" max="999"
                step={isDivisibleOrderItemUnit(unit) ? "0.001" : "1"} value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))} aria-label="Miktar" />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Birim</span>
              <OrderItemUnitCombobox
                value={unit}
                className="h-9 w-full"
                onValueChange={(next) => {
                  setUnit(next)
                  if (!isDivisibleOrderItemUnit(next)) setQuantity((q) => Math.max(1, Math.round(q)))
                  else setCreateStockItem(false)
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Birim Fiyat</span>
              <InputGroup className="h-9 w-32">
                <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
                <InputGroupInput
                  type="text"
                  inputMode="text"
                  placeholder="100 veya 2×100"
                  className="text-sm tabular-nums"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  onBlur={() => { const value = evaluateMoneyExpression(priceDraft); if (value != null) setPriceDraft(String(value / 100).replace(".", ",")) }}
                />
              </InputGroup>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Stok kartı olarak kaydet</p>
              <p className="text-xs text-muted-foreground">
                {isDivisibleOrderItemUnit(unit)
                  ? "Ondalıklı ölçü birimleri stok kartına bağlanamaz; kalem yalnız bu iş emrine eklenir."
                  : "Parça, kodu ile Stok / Parçalar listesine eklenir. Stok miktarı 0 başlar, bu kalem stoktan düşmez."}
              </p>
            </div>
            <Switch
              checked={createStockItem}
              onCheckedChange={(v) => { setCreateStockItem(v); setError(null) }}
              aria-label="Stok kartı olarak kaydet"
              disabled={isDivisibleOrderItemUnit(unit)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
