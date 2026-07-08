"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentBadge } from "@/components/app/status-badge"
import type { OrderStatusKey } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira, percentToBps, applyDiscountKurus, applyTaxBps, addKurus } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/cashbox/status"
import type { PaymentMethodKey } from "@/lib/cashbox/status"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import {
  Plus,
  Trash2,
  Wrench,
  User,
  Calendar,
  Loader2,
  Pencil,
  X,
  Save,
  Receipt,
  Calculator,
  Wallet,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { SendReminderButton } from "@/components/app/send-reminder-button"
import { TecdocPartPicker } from "@/components/app/tecdoc-part-picker"
import { PartBrandCombobox } from "@/components/app/part-brand-combobox"
import { ItemCategoryCascade } from "@/components/app/item-category-cascade"
import { formatPrice } from "@/lib/parts/format"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"

export type OrderItem = {
  id: string
  type: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
  brand: string | null
  category: string | null
  categoryId: number | null
}

export type Totals = {
  partsTotal: number
  laborTotal: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  hasAnyPrice: boolean
  partsCount: number
  laborCount: number
}

export type OrderDetailData = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  assignedAt: string | null
  completedAt: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  notes: string | null
  discountAmount: number | null
  taxRate: number | null
  totals: Totals
  items: OrderItem[]
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    contactName: string | null
    type: string
    phone: string
    email: string | null
  }
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; catalogVehicleTypeId: number | null; engineDisplacement: string | null; enginePower: string | null; fuelType: string | null; firstRegistrationDate: string | null }
  intake: {
    id: string
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    internalNote: string | null
    createdAt: string
    approvedAt: string | null
    shareToken: string | null
  }
  paidAmount: number
  remainingAmount: number
  collectionHistory: Array<{
    id: string
    amount: number
    method: string
    status: string
    paymentDate: string
    referenceNo: string | null
    note: string | null
    cancellationReason: string | null
  }>
}

export type PricingMetaDraft = {
  technicianName: string
  estimatedDeliveryAt: string
  discountAmount: string
  taxRate: string
  notes: string
}

// `primary: true` marks the happy-path forward action; other forwards are
// secondary, `cancelled` is destructive. Consumed by the merged detail header.
export const NEXT_STATUSES: Record<string, { key: OrderStatusKey; label: string; primary?: boolean }[]> = {
  // Onay artık teslimde (delivery OTP) alınır, kabulde değil (bkz. status-transitions.ts).
  // Taslak iş emri doğrudan başlar; "Onaya Gönder" kaldırıldı. waiting_approval sadece
  // eski kayıtlar ileri gidebilsin diye durur (onay jargonu olmadan).
  draft: [{ key: "in_progress", label: "Başla", primary: true }],
  waiting_approval: [
    { key: "in_progress", label: "Başla", primary: true },
    { key: "cancelled", label: "İptal" },
  ],
  approved: [{ key: "in_progress", label: "Başla", primary: true }, { key: "waiting_parts", label: "Parça Bekliyor" }],
  in_progress: [
    { key: "waiting_parts", label: "Parça Bekliyor" },
    { key: "ready_for_delivery", label: "Teslime Hazır", primary: true },
  ],
  waiting_parts: [
    { key: "in_progress", label: "Devam Et", primary: true },
    { key: "ready_for_delivery", label: "Teslime Hazır" },
  ],
  ready_for_delivery: [{ key: "delivered", label: "Teslim Edildi", primary: true }, { key: "cancelled", label: "İptal" }],
  delivered: [],
  cancelled: [{ key: "draft", label: "Yeniden Aktif Et", primary: true }],
}

export function PartsLaborCard({
  orderId,
  status,
  items,
  vehicle,
  onError,
  onLoading,
  loading,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: { id: string; catalogVehicleTypeId: number | null; vin: string | null; modelYear: number | null; engineDisplacement: string | null; enginePower: string | null; fuelType: string | null; firstRegistrationDate: string | null }
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
}) {
  const router = useRouter()
  const locked = isOrderLocked(status as OrderStatus)
  const [addingType, setAddingType] = useState<"part" | "labor" | null>(null)
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [unit, setUnit] = useState("adet")
  const [qty, setQty] = useState("1")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("")
  const [brand, setBrand] = useState("")
  const [category, setCategory] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [catalogResults, setCatalogResults] = useState<Array<{ id: string; name: string; sku: string | null; stockQty: number; criticalStockQty: number; salePrice: number | null; unit: string; isActive: boolean }>>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  // Set when the part was picked from the TecDoc vehicle catalog; cleared on
  // reset and when a local stock part is selected instead.
  const [tecdocArticleId, setTecdocArticleId] = useState<number | null>(null)
  // Kendi stoğundan seçilen parça (PartStockItem.id). Boşsa manuel/katalog parçası.
  const [partId, setPartId] = useState<string | null>(null)

  // Optimistik local kopya — sunucu güncellenene kadar UI anında yanıt versin.
  const [localItems, setLocalItems] = useState<OrderItem[]>(items)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalItems(items)
  }, [items])

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t))
    }
  }, [])

  function updateItem(itemId: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) {
    // 1) Optimistik güncelleme
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
    // 2) Sunucuya gönder (miktar stepper için debounce)
    const send = async () => {
      const fd = new FormData()
      if (patch.quantity !== undefined) fd.set("quantity", String(patch.quantity))
      if (patch.unitPrice !== undefined) fd.set("unitPrice", String(patch.unitPrice))
      if (patch.brand !== undefined) fd.set("brand", patch.brand ?? "")
      if (patch.category !== undefined) fd.set("category", patch.category ?? "")
      if (patch.categoryId !== undefined) fd.set("categoryId", patch.categoryId != null ? String(patch.categoryId) : "")
      try {
        const res = await fetch(`/api/orders/items?id=${itemId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) {
          onError(data.error || "Kalem güncellenemedi")
          setLocalItems(items) // rollback
        } else {
          router.refresh() // toplamları/fiyatlandırmayı tazele
        }
      } catch {
        onError("Bir hata oluştu")
        setLocalItems(items) // rollback
      }
    }
    if (opts?.debounce) {
      // Alan-bazlı anahtar: aynı kalemde marka ile miktar birbirinin bekleyen
      // gönderimini iptal etmesin (paylaşılan itemId anahtarı bunu yapardı).
      const key = `${itemId}:${Object.keys(patch).sort().join(",")}`
      clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(send, 500)
    } else {
      void send()
    }
  }

  const parts = localItems.filter((i) => i.type === "part")
  const labor = localItems.filter((i) => i.type === "labor")

  async function searchCatalog(query: string) {
    if (query.length < 1) { setCatalogResults([]); return }
    setCatalogLoading(true)
    try {
      const res = await fetch(`/api/parts/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.parts) setCatalogResults(data.parts)
    } catch { /* ignore */ }
    finally { setCatalogLoading(false) }
  }

  function selectCatalogPart(partId: string) {
    const part = catalogResults.find((p) => p.id === partId)
    if (!part) return
    setName(part.name)
    setSku(part.sku || "")
    setUnit(part.unit)
    // Catalog prices are kuruş; the input holds TRY (lira).
    setPrice(part.salePrice != null ? String(kurusToLira(part.salePrice)) : "")
    setQty("1")
    setPartId(part.id)
    setShowCatalog(false)
    setCatalogSearch("")
    setCatalogResults([])
    setTecdocArticleId(null)
  }

  function resetForm() {
    setName("")
    setSku("")
    setUnit("adet")
    setQty("1")
    setPrice("")
    setNote("")
    setBrand("")
    setCategory("")
    setCategoryId(null)
    setAddingType(null)
    setShowCatalog(false)
    setCatalogSearch("")
    setCatalogResults([])
    setTecdocArticleId(null)
    setPartId(null)
  }

  async function handleAdd() {
    if (!name.trim() || !addingType) return
    onLoading(true)
    onError("")
    const formData = new FormData()
    formData.set("serviceOrderId", orderId)
    formData.set("type", addingType)
    formData.set("name", name)
    if (sku) formData.set("sku", sku)
    if (unit) formData.set("unit", unit)
    formData.set("quantity", qty || "1")
    // Price input is TRY (lira); the server stores kuruş.
    if (price) formData.set("unitPrice", String(liraToKurus(Number(price))))
    if (note) formData.set("note", note)
    if (addingType === "part" && brand) formData.set("brand", brand)
    if (addingType === "part" && category) formData.set("category", category)
    if (addingType === "part" && categoryId != null) formData.set("categoryId", String(categoryId))
    if (addingType === "part" && tecdocArticleId != null) formData.set("tecdocArticleId", String(tecdocArticleId))
    // Kendi stoğundan seçilen parça — server stok düşüp partId'yi kaydeder.
    if (addingType === "part" && partId) formData.set("partId", partId)

    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        resetForm()
        router.refresh()
      } else {
        onError(data.error || "Kalem eklenemedi")
      }
    } catch {
      onError("Bir hata oluştu")
    } finally {
      onLoading(false)
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await fetch(`/api/orders/items?id=${itemId}&orderId=${orderId}`, { method: "DELETE" })
      router.refresh()
    } catch {
      onError("Kalem silinemedi")
    }
  }

  function lineTotal(item: OrderItem): number | null {
    if (item.totalPrice != null && item.totalPrice > 0) return item.totalPrice
    if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice * item.quantity
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            Kullanılan Parçalar & İşçilikler
          </CardTitle>
          <span className="text-xs text-muted-foreground">{items.length} kalem</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Parçalar ({parts.length})</p>
            <div className="space-y-1.5">
              {parts.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  lineTotal={lineTotal(item)}
                  onRemove={locked ? undefined : handleRemove}
                  onUpdate={locked ? undefined : updateItem}
                  vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                  editable={!locked && item.type === "part"}
                />
              ))}
            </div>
          </div>
        )}
        {labor.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">İşçilikler ({labor.length})</p>
            <div className="space-y-1.5">
              {labor.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  lineTotal={lineTotal(item)}
                  onRemove={locked ? undefined : handleRemove}
                  editable={false}
                />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
            Henüz kalem eklenmedi
          </div>
        )}

        {locked ? (
          <p className="text-xs text-muted-foreground/70 text-center pt-2 border-t">
            Teslim edilmiş veya iptal edilmiş iş emrinde kalem eklenemez/silinemez
          </p>
        ) : !addingType ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={() => setAddingType("part")} className="flex-1 sm:flex-none">
              <Plus className="size-3.5 mr-1" /> Parça Ekle
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddingType("labor")} className="flex-1 sm:flex-none">
              <Plus className="size-3.5 mr-1" /> İşçilik Ekle
            </Button>
            <Button size="sm" variant="ghost" disabled className="text-muted-foreground/70">
              <Plus className="size-3.5 mr-1" /> Barkodla Ekle <span className="ml-1 text-[10px] uppercase">Yakında</span>
            </Button>
          </div>
        ) : (
            <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {addingType === "part" ? "Yeni Parça" : "Yeni İşçilik"}
              </p>
              <button
                onClick={resetForm}
                className="text-muted-foreground/70 hover:text-muted-foreground p-1"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            {addingType === "part" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={catalogSearch}
                      onChange={(e) => { setCatalogSearch(e.target.value); searchCatalog(e.target.value) }}
                      placeholder="Katalogdan parça ara..."
                    />
                    {catalogLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">Aranıyor...</span>}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCatalog(!showCatalog)}>
                    Katalogdan Ekle
                  </Button>
                </div>
                {showCatalog && catalogResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white shadow-sm">
                    {catalogResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectCatalogPart(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">{p.name}</span>
                          {p.sku && <span className="text-xs text-muted-foreground ml-2 font-mono">{p.sku}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StockStatusBadge stockQty={p.stockQty} criticalStockQty={p.criticalStockQty} isActive={p.isActive} />
                          {p.salePrice != null && <span className="text-xs font-medium text-foreground">{formatPrice(p.salePrice)}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <TecdocPartPicker
                  vehicle={vehicle}
                  onSelect={(sel) => {
                    setName(sel.name)
                    setSku(sel.articleNo)
                    setUnit("adet")
                    setTecdocArticleId(sel.tecdocArticleId)
                    // TecDoc katalog parçası kendi stoğumuzdan değil — partId'yi temizle.
                    setPartId(null)
                    if (!brand && sel.supplierName) setBrand(sel.supplierName)
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">{addingType === "part" ? "Parça Adı *" : "İşçilik Adı *"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={addingType === "part" ? "Fren balatası, yağ filtresi..." : "Yağ değişimi, fren ayarı..."} />
              </div>
              {addingType === "part" && (
                <div>
                  <Label className="text-xs">Kod / SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opsiyonel" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Miktar</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Birim</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="adet/saat" />
              </div>
              <div>
                <Label className="text-xs">Birim Fiyat ₺</Label>
                <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
              </div>
            </div>
            {addingType === "part" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Marka</Label>
                  <PartBrandCombobox value={brand} onChange={setBrand} />
                </div>
                <div>
                  <Label className="text-xs">Kategori</Label>
                  <div className="mt-1">
                    <ItemCategoryCascade
                      vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                      value={category || null}
                      onSelect={(sel) => { setCategory(sel.category); setCategoryId(sel.categoryId) }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Not</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={loading || !name.trim()} size="sm" className="flex-1">
                {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
                Ekle
              </Button>
              <Button variant="outline" onClick={resetForm} size="sm">
                İptal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ItemRow({
  item,
  lineTotal,
  onRemove,
  onUpdate,
  vehicleTypeId,
  editable,
}: {
  item: OrderItem
  lineTotal: number | null
  onRemove?: (id: string) => void
  onUpdate?: (id: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) => void
  vehicleTypeId?: number | null
  editable?: boolean
}) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [brandOpen, setBrandOpen] = useState(false)

  function startPrice() {
    setPriceDraft(item.unitPrice != null ? String(kurusToLira(item.unitPrice)) : "")
    setEditingPrice(true)
  }
  function commitPrice() {
    setEditingPrice(false)
    const lira = Number(priceDraft)
    if (!priceDraft || Number.isNaN(lira) || lira < 0) return
    const kurus = liraToKurus(lira)
    if (kurus !== item.unitPrice) onUpdate?.(item.id, { unitPrice: kurus })
  }

  return (
    <div className="p-2.5 bg-muted rounded-lg space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
          {item.sku && <span className="text-[10px] font-mono text-muted-foreground bg-white px-1.5 py-0.5 rounded border border-border">{item.sku}</span>}
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <span className={cn("text-sm font-semibold", lineTotal == null ? "text-muted-foreground/70 font-normal text-xs" : "text-foreground")}>
            {lineTotal != null ? formatTRY(lineTotal) : "—"}
          </span>
          {onRemove && (
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              aria-label="Kalemi sil"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {editable && onUpdate ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Miktar stepper */}
          <div className="inline-flex items-center rounded-lg border border-border bg-white">
            <button
              type="button"
              disabled={item.quantity <= 1}
              onClick={() => onUpdate(item.id, { quantity: item.quantity - 1 }, { debounce: true })}
              className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Azalt"
            >
              −
            </button>
            <span className="px-2 text-xs font-medium tabular-nums">{item.quantity} {item.unit || "adet"}</span>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 }, { debounce: true })}
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
              aria-label="Arttır"
            >
              +
            </button>
          </div>

          {/* Fiyat inline */}
          {editingPrice ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPrice()
                if (e.key === "Escape") setEditingPrice(false)
              }}
              className="h-8 w-24 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={startPrice}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted"
            >
              <Pencil className="size-3 text-muted-foreground" />
              {item.unitPrice != null ? formatTRY(item.unitPrice) : "Fiyat"}
            </button>
          )}

          {/* Marka */}
          {brandOpen ? (
            <div className="w-40">
              <PartBrandCombobox
                value={item.brand || ""}
                onChange={(v) => onUpdate(item.id, { brand: v }, { debounce: true })}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBrandOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted max-w-40"
            >
              <span className="truncate">{item.brand || "Marka"}</span>
            </button>
          )}

          {/* Kategori cascade — key, kalıcı kategori değişince (router.refresh sonrası)
              serbest-metin fallback'ının input'unu yeniden tohumlaması için remount ettirir. */}
          <ItemCategoryCascade
            key={`cat-${item.id}-${item.category ?? ""}`}
            vehicleTypeId={vehicleTypeId ?? null}
            value={item.category}
            onSelect={(sel) => onUpdate(item.id, { category: sel.category, categoryId: sel.categoryId })}
          />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {item.quantity} {item.unit || (item.type === "part" ? "adet" : "saat")}
          {item.unitPrice ? ` × ${formatTRY(item.unitPrice)}` : ""}
          {item.brand && ` • ${item.brand}`}
          {item.category && ` • ${item.category}`}
          {item.note && ` • ${item.note}`}
        </div>
      )}
    </div>
  )
}

export function PricingSummaryCard({
  totals,
  paymentStatus,
  paidAmount,
  remainingAmount,
  locked,
  editingMeta,
  setEditingMeta,
  metaDraft,
  setMetaDraft,
  saveMeta,
  loading,
}: {
  totals: Totals
  paymentStatus: string
  paidAmount: number
  remainingAmount: number
  locked: boolean
  editingMeta: boolean
  setEditingMeta: (b: boolean) => void
  metaDraft: PricingMetaDraft
  setMetaDraft: (v: PricingMetaDraft) => void
  saveMeta: () => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="size-4 text-muted-foreground" />
            Fiyatlandırma
          </CardTitle>
          <PaymentBadge status={paymentStatus} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <SummaryRow label="Parça Toplamı" value={totals.partsCount > 0 ? formatTRY(totals.partsTotal) : "—"} muted={totals.partsCount === 0} />
        <SummaryRow label="İşçilik Toplamı" value={totals.laborCount > 0 ? formatTRY(totals.laborTotal) : "—"} muted={totals.laborCount === 0} />
            <div className="border-t pt-2 mt-2">
              <SummaryRow label="Genel Toplam" value={totals.hasAnyPrice ? formatTRY(totals.grandTotal) : "—"} bold large />
            </div>
            {paidAmount > 0 && (
              <>
                <SummaryRow label="Tahsil Edilen" value={formatTRY(paidAmount)} bold tone="emerald" />
                <SummaryRow label="Kalan Bakiye" value={formatTRY(remainingAmount)} bold tone={remainingAmount > 0 ? "rose" : "emerald"} />
              </>
            )}
            {editingMeta ? (
          <div className="space-y-2.5 pt-2">
            <div>
              <Label className="text-xs">İndirim (₺)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={metaDraft.discountAmount}
                onChange={(e) => setMetaDraft({ ...metaDraft, discountAmount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">KDV Oranı (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={metaDraft.taxRate}
                onChange={(e) => setMetaDraft({ ...metaDraft, taxRate: e.target.value })}
                placeholder="0"
              />
            </div>
            <SummaryRow label="KDV Tutarı" value={totals.hasAnyPrice && (Number(metaDraft.taxRate) || 0) > 0 ? formatTRY(applyTaxBps(applyDiscountKurus(totals.subtotal, liraToKurus(Number(metaDraft.discountAmount) || 0)), percentToBps(Number(metaDraft.taxRate) || 0))) : "—"} muted />
            <div className="border-t pt-2 mt-2">
              <SummaryRow
                label="Genel Toplam"
                value={totals.hasAnyPrice ? formatTRY(calculatePreviewTotal(totals.subtotal, metaDraft)) : "—"}
                bold
                large
              />
            </div>
          </div>
        ) : (
          <>
            <SummaryRow label="İndirim" value={totals.discountAmount > 0 ? formatTRY(totals.discountAmount) : "—"} muted={totals.discountAmount === 0} />
            <SummaryRow
              label={`KDV (${orderTaxRateDisplay(totals)})`}
              value={totals.taxAmount > 0 ? formatTRY(totals.taxAmount) : "—"}
              muted={totals.taxAmount === 0}
            />
            <div className="border-t pt-2 mt-2">
              <SummaryRow label="Genel Toplam" value={totals.hasAnyPrice ? formatTRY(totals.grandTotal) : "—"} bold large />
            </div>
          </>
        )}

        <div className="pt-3 border-t">
          {locked ? (
            <p className="text-xs text-muted-foreground/70 text-center">
              Teslim edilmiş veya iptal edilmiş iş emrinde fiyatlandırma düzenlenemez
            </p>
          ) : editingMeta ? (
            <div className="flex gap-2">
              <Button onClick={saveMeta} disabled={loading} size="sm" className="flex-1">
                {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
                Kaydet
              </Button>
              <Button variant="outline" onClick={() => setEditingMeta(false)} size="sm">
                İptal
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setEditingMeta(true)}
              size="sm"
              className="w-full"
            >
              <Pencil className="size-3.5 mr-1" /> İskonto & KDV
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// subtotal is kuruş; draft fields are TRY (lira) / percent. Preview only.
function calculatePreviewTotal(subtotal: number, draft: { discountAmount: string; taxRate: string }) {
  const afterDiscount = applyDiscountKurus(subtotal, liraToKurus(Number(draft.discountAmount) || 0))
  const tax = applyTaxBps(afterDiscount, percentToBps(Number(draft.taxRate) || 0))
  return addKurus(afterDiscount, tax)
}

function orderTaxRateDisplay(totals: Totals): string {
  if (totals.subtotal === 0) return "0%"
  return `${Math.round((totals.taxAmount / Math.max(1, totals.subtotal - totals.discountAmount)) * 100)}%`
}

function SummaryRow({
  label,
  value,
  bold,
  large,
  muted,
  tone,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  muted?: boolean
  tone?: "slate" | "emerald" | "rose"
}) {
  const toneColor = tone === "emerald" ? "text-success" : tone === "rose" ? "text-destructive" : "text-foreground"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(muted ? "text-muted-foreground/70" : toneColor, large && "text-lg font-bold text-foreground", bold && !large && toneColor)}>
        {value}
      </span>
    </div>
  )
}

export function OrderInfoCard({
  order,
  technicians,
}: {
  order: OrderDetailData
  technicians?: { id: string; fullName: string; role: string }[]
}) {
  const locked = isOrderLocked(order.status as OrderStatus)
  const [isPending, startTransition] = useTransition()
  const handleAssign = (technicianId: string) => {
    startTransition(async () => {
      const { assignTechnicianAction } = await import("@/app/(app)/technician/actions")
      await assignTechnicianAction(order.id, technicianId)
      window.location.reload()
    })
  }
  const handleUnassign = () => {
    startTransition(async () => {
      const { unassignTechnicianAction } = await import("@/app/(app)/technician/actions")
      await unassignTechnicianAction(order.id)
      window.location.reload()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          İş Emri Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <InfoRow label="İş No" value={order.workOrderNo} mono />
        <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} icon={Calendar} />
        <InfoRow
          label="Tahmini Teslim"
          value={order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "—"}
          icon={Calendar}
        />
        {order.completedAt && (
          <InfoRow label="Tamamlanma" value={formatDateTime(order.completedAt)} icon={Calendar} />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Atanan Usta</span>
          <div className="flex items-center gap-2">
            {order.assignedTechnicianName ? (
              <>
                <span className="text-sm text-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground/70" />
                  {order.assignedTechnicianName}
                </span>
                {!locked && (
                  <button
                    onClick={handleUnassign}
                    disabled={isPending}
                    className="text-[11px] text-foreground hover:text-foreground/80 underline disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground/70">—</span>
            )}
          </div>
        </div>
        {!locked && technicians && technicians.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {technicians.map((t) => (
              <button
                key={t.id}
                onClick={() => handleAssign(t.id)}
                disabled={isPending || t.id === order.assignedTechnicianId}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors touch-manipulation disabled:opacity-50",
                  t.id === order.assignedTechnicianId
                    ? "bg-primary/10 text-foreground border border-primary/20"
                    : "bg-muted text-muted-foreground border border-border hover:bg-primary/10 hover:border-primary/20"
                )}
              >
                <User className="size-3" />
                {t.fullName}
              </button>
            ))}
          </div>
        )}
        {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
          <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
        )}
        {order.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Notlar</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1.5">Ödeme</p>
          <PaymentBadge status={order.paymentStatus} size="md" />
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  mono,
  icon: Icon,
}: {
  label: string
  value: string
  mono?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground flex items-center gap-1.5", mono && "font-mono text-xs")}>
        {Icon && <Icon className="size-3.5 text-muted-foreground/70" />}
        {value}
      </span>
    </div>
  )
}

export function PaymentHistoryCard({
  orderId,
  isCancelled,
  totals,
  paidAmount,
  remainingAmount,
  collections,
  customerId,
  customerName,
}: {
  orderId: string
  isCancelled: boolean
  totals: Totals
  paidAmount: number
  remainingAmount: number
  collections: Array<{ id: string; amount: number; method: string; status: string; paymentDate: string; referenceNo: string | null; note: string | null; cancellationReason: string | null }>
  customerId: string
  customerName: string
}) {
  const cancelledCollections = collections.filter((c) => c.status === "cancelled")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            Tahsilat Geçmişi
          </CardTitle>
          {!isCancelled && (
            <Link
              href={`/cashbox/payments/new?orderId=${orderId}`}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors touch-manipulation"
            >
              <Plus className="size-3" />
              Tahsilat Ekle
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {collections.length === 0 ? (
          <div className="text-center py-4">
            <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Henüz tahsilat kaydı yok</p>
            {!isCancelled && (
              <Link
                href={`/cashbox/payments/new?orderId=${orderId}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="size-3.5" /> İlk tahsilatı ekle
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {collections.map((c) => {
              const methodLabel = PAYMENT_METHOD_LABELS[c.method as PaymentMethodKey] || c.method
              const isRowCancelled = c.status === "cancelled"
              return (
                <Link
                  key={c.id}
                  href={`/cashbox/payments/${c.id}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isRowCancelled ? "bg-destructive/10 hover:bg-destructive/10 border border-destructive/20" : "bg-muted hover:bg-muted"}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isRowCancelled ? "text-destructive line-through" : "text-foreground"}`}>{formatTRY(c.amount)}</p>
                      <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[11px] font-medium ${isRowCancelled ? "bg-destructive/10 text-foreground border-destructive/20" : "bg-success/10 text-foreground border-success/20"}`}>
                        {isRowCancelled ? "İptal" : methodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.paymentDate)}</p>
                    {isRowCancelled && c.cancellationReason && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{c.cancellationReason}</p>
                    )}
                    {!isRowCancelled && c.referenceNo && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">Ref: {c.referenceNo}</p>
                    )}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/70 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
        {totals.hasAnyPrice && (
          <div className="border-t pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Genel Toplam</span>
              <span className="font-medium text-foreground">{formatTRY(totals.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tahsil Edilen</span>
              <span className="font-medium text-foreground">{formatTRY(paidAmount)}</span>
            </div>
            {cancelledCollections.length > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>İptal Edilen</span>
                <span className="font-medium text-foreground">{formatTRY(cancelledCollections.reduce((s, c) => s + c.amount, 0))}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">Kalan</span>
              <span className="font-bold text-foreground">{formatTRY(remainingAmount)}</span>
            </div>
          </div>
        )}
        {remainingAmount > 0 && totals.hasAnyPrice && (
          <div className="pt-2 mt-1">
            <SendReminderButton
              customerId={customerId}
              serviceOrderId={orderId}
              customerName={customerName}
              remainingAmount={remainingAmount}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
