"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Search, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/app/order-management-panel"
import { PartBrandCombobox } from "@/components/app/part-brand-combobox"
import { ItemCategoryCascade } from "@/components/app/item-category-cascade"
import { TecdocPartPicker, type PickerVehicle } from "@/components/app/tecdoc-part-picker"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string }

function toRow(i: OrderItem): Row { return { ...i } }

export function PartsLaborGrid({
  orderId, status, items, vehicle, onError, onLoading, loading,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: PickerVehicle
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
}) {
  const router = useRouter()
  const locked = isOrderLocked(status as OrderStatus)
  const [rows, setRows] = useState<Row[]>(items.map(toRow))
  const draftCounter = useRef(0)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Sunucu items'ı senkronla ama kaydedilmemiş taslakları KORU.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => [...items.map(toRow), ...prev.filter((r) => r.__draft)])
  }, [items])

  useEffect(() => {
    const timers = saveTimers.current
    return () => { Object.values(timers).forEach((t) => clearTimeout(t)) }
  }, [])

  function addDraft() {
    draftCounter.current += 1
    const tempId = `draft-${draftCounter.current}`
    setRows((prev) => [...prev, {
      id: tempId, tempId, __draft: true, type: "part", name: "", sku: null, unit: "adet",
      quantity: 1, unitPrice: null, totalPrice: null, note: null, brand: null, category: null, categoryId: null,
    }])
  }

  function patchLocal(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  // Taslak satırı sunucuya kaydet (ad dolunca). Çift-kaydet guard: __saving.
  async function persistDraft(row: Row) {
    if (!row.__draft || row.__saving || !row.name.trim()) return
    patchLocal(row.id, { __saving: true })
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", row.type)
    fd.set("name", row.name)
    if (row.sku) fd.set("sku", row.sku)
    if (row.unit) fd.set("unit", row.unit)
    fd.set("quantity", String(row.quantity))
    if (row.unitPrice != null) fd.set("unitPrice", String(row.unitPrice))
    if (row.brand) fd.set("brand", row.brand)
    if (row.category) fd.set("category", row.category)
    if (row.categoryId != null) fd.set("categoryId", String(row.categoryId))
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.id) {
        // temp satırı gerçek id ile değiştir; __draft kalkar. router.refresh totalleri tazeler.
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, id: data.id, tempId: undefined, __draft: false, __saving: false } : r)))
        router.refresh()
      } else {
        onError(data.error || "Kalem eklenemedi")
        patchLocal(row.id, { __saving: false })
      }
    } catch {
      onError("Bir hata oluştu")
      patchLocal(row.id, { __saving: false })
    }
  }

  // Kalıcı satır hücre patch'i (debounce'lu, alan-bazlı anahtar).
  function persistUpdate(rowId: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) {
    const send = async () => {
      const fd = new FormData()
      if (patch.quantity !== undefined) fd.set("quantity", String(patch.quantity))
      if (patch.unitPrice !== undefined) fd.set("unitPrice", String(patch.unitPrice))
      if (patch.brand !== undefined) fd.set("brand", patch.brand ?? "")
      if (patch.category !== undefined) fd.set("category", patch.category ?? "")
      if (patch.categoryId !== undefined) fd.set("categoryId", patch.categoryId != null ? String(patch.categoryId) : "")
      if (patch.sku !== undefined) fd.set("sku", patch.sku ?? "")
      if (patch.name !== undefined) fd.set("name", patch.name)
      if (patch.unit !== undefined) fd.set("unit", patch.unit ?? "")
      try {
        const res = await fetch(`/api/orders/items?id=${rowId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) { onError(data.error || "Kalem güncellenemedi"); setRows(items.map(toRow)) }
        else router.refresh()
      } catch { onError("Bir hata oluştu"); setRows(items.map(toRow)) }
    }
    if (opts?.debounce) {
      const key = `${rowId}:${Object.keys(patch).sort().join(",")}`
      clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(send, 500)
    } else { void send() }
  }

  // Bir satırdaki değişikliği uygula: taslak → local + (ad ise) kaydet; kalıcı → optimistik + PATCH.
  function onCell(row: Row, patch: Partial<Row>, opts?: { debounce?: boolean }) {
    patchLocal(row.id, patch)
    if (row.__draft) {
      const next = { ...row, ...patch }
      if (next.name.trim() && !row.__saving) void persistDraft(next)
      return
    }
    persistUpdate(row.id, patch, opts)
  }

  async function removeRow(row: Row) {
    if (row.__draft) { setRows((prev) => prev.filter((r) => r.id !== row.id)); return }
    try {
      await fetch(`/api/orders/items?id=${row.id}&orderId=${orderId}`, { method: "DELETE" })
      router.refresh()
    } catch { onError("Kalem silinemedi") }
  }

  return (
    <div className="space-y-2">
      {/* Masaüstü tablo başlığı */}
      <div className="hidden md:grid grid-cols-[7rem_1fr_auto_auto_auto] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Tür</span><span>Parça / İşçilik</span><span>Miktar</span><span>Birim Fiyat</span><span className="text-right">Toplam</span>
      </div>

      {rows.length === 0 && (
        <p className="text-center py-6 text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
      )}

      <div className="space-y-1.5">
        {rows.map((row) => (
          <GridRow
            key={row.id}
            row={row}
            locked={locked}
            vehicle={vehicle}
            onCell={onCell}
            onRemove={removeRow}
          />
        ))}
      </div>

      {!locked && (
        <Button type="button" size="sm" variant="outline" onClick={addDraft} className="w-full sm:w-auto" disabled={loading}>
          <Plus className="size-3.5 mr-1" /> Yeni satır
        </Button>
      )}
    </div>
  )
}

function GridRow({ row, locked, vehicle, onCell, onRemove }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean }) => void
  onRemove: (row: Row) => void
}) {
  const isPart = row.type === "part"
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)

  const lineTotal = row.totalPrice != null && row.totalPrice > 0
    ? row.totalPrice
    : (row.unitPrice != null && row.unitPrice > 0 ? row.unitPrice * row.quantity : null)

  function startPrice() { setPriceDraft(row.unitPrice != null ? String(kurusToLira(row.unitPrice)) : ""); setEditingPrice(true) }
  function commitPrice() {
    setEditingPrice(false)
    const lira = Number(priceDraft)
    if (!priceDraft || Number.isNaN(lira) || lira < 0) return
    const kurus = liraToKurus(lira)
    if (kurus !== row.unitPrice) onCell(row, { unitPrice: kurus })
  }

  const editable = !locked

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 md:p-0 md:border-0 md:bg-transparent">
      <div className="grid gap-2 md:grid-cols-[7rem_1fr_auto_auto_auto] md:items-center md:px-2 md:py-1.5 md:rounded-lg md:bg-muted">
        {/* Tür */}
        <div className="flex items-center justify-between md:block">
          {row.__draft && editable ? (
            <Select value={row.type} onValueChange={(v) => onCell(row, { type: v as ItemType })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="part">Yedek Parça</SelectItem>
                <SelectItem value="labor">İşçilik</SelectItem>
                <SelectItem value="external_labor">Dış İşçilik</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[row.type as ItemType] ?? row.type}</span>
          )}
          {/* mobilde sil butonu üst satırda */}
          {editable && (
            <button onClick={() => onRemove(row)} className="md:hidden p-1 text-muted-foreground/70 hover:text-destructive" aria-label="Sil">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {/* Parça / Ad */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <Input
              value={row.name}
              onChange={(e) => onCell(row, { name: e.target.value })}
              onBlur={() => { if (row.__draft && row.name.trim()) onCell(row, {}) }}
              placeholder={isPart ? "Parça adı" : "İşçilik adı"}
              disabled={!editable || row.__saving}
              className="h-8 text-sm"
            />
            {isPart && editable && (
              <button
                type="button"
                onClick={() => setTecdocOpen(true)}
                disabled={vehicle?.catalogVehicleTypeId == null}
                title={vehicle?.catalogVehicleTypeId == null ? "Araç TecDoc'ta eşleşmedi" : "TecDoc kataloğundan seç"}
                className="shrink-0 p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                aria-label="Katalogdan parça seç"
              >
                <Search className="size-3.5" />
              </button>
            )}
            {row.__saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
          </div>
          {row.sku && <span className="text-[10px] font-mono text-muted-foreground">{row.sku}</span>}
          {isPart && editable && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="w-32"><PartBrandCombobox value={row.brand || ""} onChange={(v) => onCell(row, { brand: v }, { debounce: true })} /></div>
              <ItemCategoryCascade
                key={`cat-${row.id}-${row.category ?? ""}`}
                vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                value={row.category}
                onSelect={(sel) => onCell(row, { category: sel.category, categoryId: sel.categoryId })}
              />
            </div>
          )}
        </div>

        {/* Miktar */}
        <div className="flex items-center gap-2 md:justify-center">
          <span className="md:hidden text-xs text-muted-foreground">Miktar</span>
          <div className="inline-flex items-center rounded-lg border border-border bg-white">
            <button type="button" disabled={!editable || row.quantity <= 1} onClick={() => onCell(row, { quantity: row.quantity - 1 }, { debounce: true })} className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Azalt">−</button>
            <span className="px-2 text-xs font-medium tabular-nums">{row.quantity}</span>
            <button type="button" disabled={!editable} onClick={() => onCell(row, { quantity: row.quantity + 1 }, { debounce: true })} className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Arttır">+</button>
          </div>
        </div>

        {/* Birim Fiyat */}
        <div className="flex items-center gap-2 md:justify-end">
          <span className="md:hidden text-xs text-muted-foreground">Fiyat</span>
          {editingPrice ? (
            <Input type="number" min="0" step="0.01" autoFocus value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)} onBlur={commitPrice}
              onKeyDown={(e) => { if (e.key === "Enter") commitPrice(); if (e.key === "Escape") setEditingPrice(false) }}
              className="h-8 w-24 text-xs" />
          ) : (
            <button type="button" onClick={() => editable && startPrice()} disabled={!editable}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted disabled:opacity-60">
              <Pencil className="size-3 text-muted-foreground" />
              {row.unitPrice != null ? formatTRY(row.unitPrice) : "Fiyat"}
            </button>
          )}
        </div>

        {/* Toplam + sil (masaüstü) */}
        <div className="flex items-center justify-between md:justify-end gap-2">
          <span className="md:hidden text-xs text-muted-foreground">Toplam</span>
          <span className={cn("text-sm font-semibold", lineTotal == null ? "text-muted-foreground/70 font-normal text-xs" : "text-foreground")}>
            {lineTotal != null ? formatTRY(lineTotal) : "—"}
          </span>
          {editable && (
            <button onClick={() => onRemove(row)} className="hidden md:inline-flex p-1 text-muted-foreground/70 hover:text-destructive" aria-label="Sil">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TecDoc modal — yalnız part satırı VE araç TecDoc'ta eşleşmişse mount edilir
          (eşleşmemişse picker VinLinkPrompt döner, tabloyu kirletir; 🔍 butonu zaten disabled). */}
      {isPart && editable && vehicle?.catalogVehicleTypeId != null && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelect={(sel) => {
            onCell(row, { name: sel.name, sku: sel.articleNo, brand: sel.supplierName, category: sel.categoryName || null, categoryId: sel.categoryId || null })
            setTecdocOpen(false)
          }}
        />
      )}
    </div>
  )
}
