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
  orderId, status, items, vehicle, onError, loading,
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
  // rows'un en güncel kopyası — async persist callback'leri bayat closure okumasın.
  const rowsRef = useRef<Row[]>(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])

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

  // Taslak satırı sunucuya kaydet. onCell'den DEBOUNCE ile tetiklenir (ilk harfte değil).
  // rowsRef'ten en güncel satırı okur; POST uçarken yapılan düzenlemeleri POST sonrası
  // "catch-up" PATCH ile gönderir → veri kaybı olmaz. Çift-kaydet guard: __saving.
  async function persistDraft(rowId: string) {
    const row = rowsRef.current.find((r) => r.id === rowId)
    if (!row || !row.__draft || row.__saving || !row.name.trim()) return
    patchLocal(rowId, { __saving: true })
    const snapshot = { ...row }
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", snapshot.type)
    fd.set("name", snapshot.name)
    if (snapshot.sku) fd.set("sku", snapshot.sku)
    if (snapshot.unit) fd.set("unit", snapshot.unit)
    fd.set("quantity", String(snapshot.quantity))
    if (snapshot.unitPrice != null) fd.set("unitPrice", String(snapshot.unitPrice))
    if (snapshot.brand) fd.set("brand", snapshot.brand)
    if (snapshot.category) fd.set("category", snapshot.category)
    if (snapshot.categoryId != null) fd.set("categoryId", String(snapshot.categoryId))
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.id) {
        const realId: string = data.id
        setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, id: realId, tempId: undefined, __draft: false, __saving: false } : r)))
        // POST uçarken kullanıcı bir şey değiştirdiyse catch-up PATCH gönder (kayıp yok).
        const latest = rowsRef.current.find((r) => r.id === rowId)
        if (latest) {
          const diff: Partial<OrderItem> = {}
          if (latest.name !== snapshot.name) diff.name = latest.name
          if (latest.sku !== snapshot.sku) diff.sku = latest.sku
          if (latest.unit !== snapshot.unit) diff.unit = latest.unit
          if (latest.quantity !== snapshot.quantity) diff.quantity = latest.quantity
          if (latest.unitPrice !== snapshot.unitPrice) diff.unitPrice = latest.unitPrice
          if (latest.brand !== snapshot.brand) diff.brand = latest.brand
          if (latest.category !== snapshot.category) diff.category = latest.category
          if (latest.categoryId !== snapshot.categoryId) diff.categoryId = latest.categoryId
          if (Object.keys(diff).length > 0) { persistUpdate(realId, diff); return }
        }
        router.refresh()
      } else {
        onError(data.error || "Kalem eklenemedi")
        patchLocal(rowId, { __saving: false })
      }
    } catch {
      onError("Bir hata oluştu")
      patchLocal(rowId, { __saving: false })
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
        if (!data.success) { onError(data.error || "Kalem güncellenemedi"); setRows((prev) => [...items.map(toRow), ...prev.filter((r) => r.__draft)]) }
        else router.refresh()
      } catch { onError("Bir hata oluştu"); setRows((prev) => [...items.map(toRow), ...prev.filter((r) => r.__draft)]) }
    }
    if (opts?.debounce) {
      const key = `${rowId}:${Object.keys(patch).sort().join(",")}`
      clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(send, 500)
    } else { void send() }
  }

  // Bir satırdaki değişikliği uygula: taslak → local + (ad doluysa) DEBOUNCE'lu kaydet; kalıcı → PATCH.
  function onCell(row: Row, patch: Partial<Row>, opts?: { debounce?: boolean }) {
    patchLocal(row.id, patch)
    if (row.__draft) {
      const next = { ...row, ...patch }
      if (next.name.trim()) {
        const key = `draft:${row.id}`
        const id = row.id
        clearTimeout(saveTimers.current[key])
        saveTimers.current[key] = setTimeout(() => persistDraft(id), 700)
      }
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
              onChange={(e) => onCell(row, { name: e.target.value }, { debounce: true })}
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
          {isPart && (editable ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="w-32"><PartBrandCombobox value={row.brand || ""} onChange={(v) => onCell(row, { brand: v }, { debounce: true })} /></div>
              <ItemCategoryCascade
                key={`cat-${row.id}-${row.category ?? ""}`}
                vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                value={row.category}
                onSelect={(sel) => onCell(row, { category: sel.category, categoryId: sel.categoryId })}
              />
            </div>
          ) : (
            (row.brand || row.category) && (
              <div className="text-xs text-muted-foreground">
                {[row.brand, row.category].filter(Boolean).join(" • ")}
              </div>
            )
          ))}
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
