"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus, Trash2, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/app/order-management-panel"
import { PartSearchInput } from "@/components/app/part-search-input"
import { PartFilterCombobox } from "@/components/app/part-filter-combobox"
import { TecdocPartPicker, type PickerVehicle } from "@/components/app/tecdoc-part-picker"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

// brandSupplierId: yalnız runtime — marka→kategori best-effort filtresi için
// seçili markanın TecDoc supplierId'sini taşır; ASLA persist edilmez.
type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string; brandSupplierId?: number | null }

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

  // Sunucu items'ı senkronla ama kaydedilmemiş taslakları KORU. Runtime-only
  // brandSupplierId (persist EDİLMEZ) önceki satırdan id ile taşınır ki
  // marka→kategori filtresi router.refresh() sonrası da yaşasın (tam yeniden
  // yüklemeye kadar; o noktada zaten en baştan best-effort).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => {
      const prevById = new Map(prev.map((r) => [r.id, r]))
      return [
        ...items.map((i) => {
          const prevRow = prevById.get(i.id)
          return prevRow ? { ...toRow(i), brandSupplierId: prevRow.brandSupplierId } : toRow(i)
        }),
        ...prev.filter((r) => r.__draft),
      ]
    })
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
    // Boş ad'ı sunucuya GÖNDERME: sunucu min(1) ile reddedip satırı eski adına
    // revert ediyordu → kayıtlı satırın adı temizlenip yeniden yazılamıyordu.
    // Ad yalnız yerelde boşaltılır; geçerli (dolu) ad yazılınca/seçilince PATCH gider.
    if (patch.name !== undefined && !patch.name.trim()) return
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
  // opts.localOnly: yalnız yereli günceller, kalıcılaştırmaz — katalog arama
  // kutusuna YAZMAK için (yazarken kaydetme; kalıcılık yalnız SEÇİMde olur).
  function onCell(row: Row, patch: Partial<Row>, opts?: { debounce?: boolean; localOnly?: boolean }) {
    patchLocal(row.id, patch)
    if (opts?.localOnly) return
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

  // Parça seçimini temizle. Taslak → yalnız yerel sıfırla. Kayıtlı kalem → adı boş
  // bırakılamayacağı (min-1) ve yerel sıfırlama refresh'te geri dolacağı için
  // sunucudan SİL ve yerine boş taslak satır koy (satır kalır, içerik gider).
  async function clearRow(row: Row) {
    if (row.__draft) {
      patchLocal(row.id, { name: "", sku: null, brand: null, category: null, categoryId: null, brandSupplierId: null })
      return
    }
    try {
      await fetch(`/api/orders/items?id=${row.id}&orderId=${orderId}`, { method: "DELETE" })
    } catch {
      onError("Kalem temizlenemedi")
      return
    }
    draftCounter.current += 1
    const tempId = `draft-${draftCounter.current}`
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              id: tempId, tempId, __draft: true, type: r.type, name: "", sku: null, unit: "adet",
              quantity: 1, unitPrice: null, totalPrice: null, note: null, brand: null, category: null, categoryId: null,
            }
          : r
      )
    )
    router.refresh()
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
      {/* Masaüstü: geniş tablo — dar ekranda kırpmak yerine yatay kaydırır. */}
      <div className="md:overflow-x-auto md:pb-1">
        <div className="space-y-1.5 md:min-w-[63rem]">
          {/* Tablo başlığı (yalnız md+) */}
          <div className="hidden md:grid grid-cols-[7rem_minmax(14rem,1.8fr)_8rem_10.5rem_5.5rem_6.5rem_5.5rem_2.25rem] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Tür</span>
            <span>Parça / İşçilik</span>
            <span>Marka</span>
            <span>Kategori</span>
            <span className="text-center">Miktar</span>
            <span className="text-right">Birim Fiyat</span>
            <span className="text-right">Toplam</span>
            <span aria-hidden />
          </div>

          {rows.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
          )}

          {rows.map((row) => (
            <GridRow
              key={row.id}
              row={row}
              locked={locked}
              vehicle={vehicle}
              onCell={onCell}
              onRemove={removeRow}
              onClear={clearRow}
            />
          ))}
        </div>
      </div>

      {!locked && (
        <Button type="button" size="sm" variant="outline" onClick={addDraft} className="w-full sm:w-auto" disabled={loading}>
          <Plus className="size-3.5 mr-1" /> Yeni satır
        </Button>
      )}
    </div>
  )
}

function GridRow({ row, locked, vehicle, onCell, onRemove, onClear }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean; localOnly?: boolean }) => void
  onRemove: (row: Row) => void
  onClear: (row: Row) => void
}) {
  const isPart = row.type === "part"
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)

  // Satır-yerel arama filtresi (persist EDİLMEZ). Combobox seçimi buraya yazar;
  // parça seçilince senkronlanır; satır temizlenince sıfırlanır.
  type PartFilter = { supplierId?: number; supplierName?: string; categoryId?: number; categoryName?: string }
  const [filter, setFilter] = useState<PartFilter>({})
  const linked = vehicle?.catalogVehicleTypeId != null

  // Katalog parçasından satırı doldur (arama seçimi + picker ortak yolu değil ama
  // aynı şekil): ad/SKU/marka/kategori tek seferde.
  function fillFromArticle(a: ArticleSearchResult) {
    onCell(row, {
      name: a.productName,
      sku: a.articleNo,
      brand: a.supplierName || null,
      category: a.categoryName || null,
      categoryId: a.categoryId || null,
    })
    setFilter({
      supplierId: a.supplierId ?? undefined,
      supplierName: a.supplierName || undefined,
      categoryId: a.categoryId ?? undefined,
      categoryName: a.categoryName || undefined,
    })
  }

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
      <div className="grid gap-2 md:grid-cols-[7rem_minmax(14rem,1.8fr)_8rem_10.5rem_5.5rem_6.5rem_5.5rem_2.25rem] md:items-center md:px-2 md:py-1.5 md:rounded-lg md:bg-muted">
        {/* Tür */}
        <div className="flex min-w-0 items-center justify-between gap-2 md:block">
          {row.__draft && editable ? (
            <Select items={TYPE_LABELS} value={row.type} onValueChange={(v) => onCell(row, { type: v as ItemType })}>
              <SelectTrigger className="w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
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
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(row)}
              className="text-muted-foreground/70 hover:text-destructive md:hidden" aria-label="Sil">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        {/* Parça / İşçilik */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            {isPart ? (
              <PartSearchInput
                value={row.name}
                sku={row.sku}
                vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                supplierId={filter.supplierId ?? null}
                categoryId={filter.categoryId ?? null}
                disabled={!editable || row.__saving}
                placeholder="Parça no veya adı"
                onNameChange={(name) => onCell(row, { name }, { localOnly: true })}
                onSelectArticle={fillFromArticle}
                onCommit={() => { if (row.name.trim()) onCell(row, { name: row.name }) }}
                onClear={() => { onClear(row); setFilter({}) }}
                showClear={editable && !!(row.name || row.sku || row.brand || row.category || row.categoryId)}
                onSearchClick={() => setTecdocOpen(true)}
                searchDisabled={vehicle?.catalogVehicleTypeId == null}
                searchTitle={vehicle?.catalogVehicleTypeId == null ? "Araç TecDoc'ta eşleşmedi" : "TecDoc kataloğundan seç"}
              />
            ) : (
              <Input
                value={row.name}
                onChange={(e) => onCell(row, { name: e.target.value }, { debounce: true })}
                onBlur={() => { if (row.__draft && row.name.trim()) onCell(row, {}) }}
                placeholder="İşçilik adı"
                disabled={!editable || row.__saving}
                className="text-sm"
              />
            )}
            {row.__saving && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Marka */}
        <div className={cn("min-w-0", !(isPart && row.brand) && "hidden md:block")}>
          {isPart && (
            <>
              {/* md+ : combobox (linked+editable) veya salt-görünür */}
              <div className="hidden md:block">
                {linked && editable ? (
                  <PartFilterCombobox
                    kind="brand"
                    vehicleTypeId={vehicle!.catalogVehicleTypeId!}
                    value={filter.supplierName ?? row.brand ?? ""}
                    disabled={row.__saving}
                    onSelect={(id, name) => setFilter((f) => ({ ...f, supplierId: id, supplierName: name }))}
                    onClear={() => setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))}
                    onOpenPicker={() => setTecdocOpen(true)}
                  />
                ) : row.brand ? (
                  <span className="block truncate text-xs text-muted-foreground">{row.brand}</span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>
              {/* mobil : yalnız salt-görünür metin (combobox mobilde yok — Karar 6) */}
              {row.brand && (
                <span className="block truncate text-xs text-muted-foreground md:hidden">
                  <span className="text-muted-foreground/70">Marka: </span>{row.brand}
                </span>
              )}
            </>
          )}
        </div>

        {/* Kategori */}
        <div className={cn("min-w-0", !(isPart && row.category) && "hidden md:block")}>
          {isPart && (
            <>
              <div className="hidden md:block">
                {linked && editable ? (
                  <PartFilterCombobox
                    kind="category"
                    vehicleTypeId={vehicle!.catalogVehicleTypeId!}
                    value={filter.categoryName ?? row.category ?? ""}
                    disabled={row.__saving}
                    onSelect={(id, name) => setFilter((f) => ({ ...f, categoryId: id, categoryName: name }))}
                    onClear={() => setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))}
                    onOpenPicker={() => setTecdocOpen(true)}
                  />
                ) : row.category ? (
                  <span className="block truncate text-xs text-muted-foreground">{row.category}</span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>
              {row.category && (
                <span className="block truncate text-xs text-muted-foreground md:hidden">
                  <span className="text-muted-foreground/70">Kategori: </span>{row.category}
                </span>
              )}
            </>
          )}
        </div>

        {/* Miktar */}
        <div className="flex items-center gap-2 md:justify-center">
          <span className="text-xs text-muted-foreground md:hidden">Miktar</span>
          <div className="inline-flex h-8 items-center rounded-lg border border-input bg-background">
            <Button type="button" variant="ghost" size="icon-xs" className="rounded-r-none" aria-label="Azalt"
              disabled={!editable || row.quantity <= 1}
              onClick={() => onCell(row, { quantity: row.quantity - 1 }, { debounce: true })}>
              <Minus />
            </Button>
            <span className="min-w-6 px-1 text-center text-xs font-medium tabular-nums">{row.quantity}</span>
            <Button type="button" variant="ghost" size="icon-xs" className="rounded-l-none" aria-label="Arttır"
              disabled={!editable}
              onClick={() => onCell(row, { quantity: row.quantity + 1 }, { debounce: true })}>
              <Plus />
            </Button>
          </div>
        </div>

        {/* Birim Fiyat */}
        <div className="flex items-center gap-2 md:justify-end">
          <span className="text-xs text-muted-foreground md:hidden">Birim Fiyat</span>
          {editingPrice ? (
            <Input type="number" min="0" step="0.01" autoFocus value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)} onBlur={commitPrice}
              onKeyDown={(e) => { if (e.key === "Enter") commitPrice(); if (e.key === "Escape") setEditingPrice(false) }}
              className="h-8 w-24 text-xs" />
          ) : (
            <Button type="button" variant="outline" disabled={!editable}
              onClick={() => editable && startPrice()} className="gap-1 font-normal">
              <Pencil className="size-3 text-muted-foreground" />
              <span className={cn("tabular-nums", row.unitPrice == null && "text-muted-foreground")}>
                {row.unitPrice != null ? formatTRY(row.unitPrice) : "Fiyat"}
              </span>
            </Button>
          )}
        </div>

        {/* Toplam */}
        <div className="flex items-center justify-between gap-2 md:justify-end">
          <span className="text-xs text-muted-foreground md:hidden">Toplam</span>
          <span className={cn("text-sm font-semibold tabular-nums", lineTotal == null ? "text-xs font-normal text-muted-foreground/70" : "text-foreground")}>
            {lineTotal != null ? formatTRY(lineTotal) : "—"}
          </span>
        </div>

        {/* Sil (masaüstü) */}
        <div className="hidden md:flex md:justify-end">
          {editable && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(row)}
              className="text-muted-foreground/70 hover:text-destructive" aria-label="Sil">
              <Trash2 className="size-4" />
            </Button>
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
          initialCategoryId={row.categoryId ?? filter.categoryId ?? null}
          initialCategoryName={row.category ?? filter.categoryName ?? null}
          initialSupplierId={row.brandSupplierId ?? filter.supplierId ?? null}
          initialSupplierName={row.brand ?? filter.supplierName ?? null}
          onSelect={(sel) => {
            onCell(row, { name: sel.name, sku: sel.articleNo, brand: sel.supplierName, category: sel.categoryName || null, categoryId: sel.categoryId || null })
            setFilter({
              supplierName: sel.supplierName || undefined,
              categoryId: sel.categoryId ?? undefined,
              categoryName: sel.categoryName || undefined,
            })
            setTecdocOpen(false)
          }}
        />
      )}
    </div>
  )
}
