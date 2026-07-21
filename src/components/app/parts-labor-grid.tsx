"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Minus, Trash2, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/app/order-management-panel"
import { PartSearchInput } from "@/components/app/part-search-input"
import { PartAttributeField } from "@/components/app/part-attribute-field"
import { TecdocPartPicker, type PickerVehicle } from "@/components/app/tecdoc-part-picker"
import { PartAttrOptionsProvider } from "@/components/app/part-attr-options"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

// brandSupplierId: yalnız runtime — marka→kategori best-effort filtresi için
// seçili markanın TecDoc supplierId'sini taşır; ASLA persist edilmez.
type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string; brandSupplierId?: number | null }

// Satır-yerel arama filtresi (persist EDİLMEZ). Combobox seçimi buraya yazar;
// parça seçilince senkronlanır; satır temizlenince sıfırlanır.
type PartFilter = { supplierId?: number; supplierName?: string; categoryId?: number; categoryName?: string }

type OnCell = (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean; localOnly?: boolean }) => void

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
  const onCell: OnCell = (row, patch, opts) => {
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

  const headCls = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

  return (
    <PartAttrOptionsProvider vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}>
    <div className="space-y-3">
      {/* Masaüstü (md+): gerçek shadcn Base <table> — dar ekranda yatay kaydırır. */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table className="min-w-[64rem] table-fixed">
          <colgroup>
            <col className="w-28" />{/* Tür */}
            <col />{/* Parça / İşçilik (kalan alan) */}
            <col className="w-36" />{/* Marka */}
            <col className="w-44" />{/* Kategori */}
            <col className="w-24" />{/* Miktar */}
            <col className="w-28" />{/* Birim Fiyat */}
            <col className="w-24" />{/* Toplam */}
            <col className="w-12" />{/* Sil */}
          </colgroup>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-muted">
              <TableHead className={headCls}>Tür</TableHead>
              <TableHead className={headCls}>Parça / İşçilik</TableHead>
              <TableHead className={headCls}>Marka</TableHead>
              <TableHead className={headCls}>Kategori</TableHead>
              <TableHead className={cn(headCls, "text-center")}>Miktar</TableHead>
              <TableHead className={cn(headCls, "text-right")}>Birim Fiyat</TableHead>
              <TableHead className={cn(headCls, "text-right")}>Toplam</TableHead>
              <TableHead className={cn(headCls, "text-right")}><span className="sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  Henüz kalem eklenmedi
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <DesktopPartRow
                  key={row.id}
                  row={row}
                  locked={locked}
                  vehicle={vehicle}
                  onCell={onCell}
                  onRemove={removeRow}
                  onClear={clearRow}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobil (<md): kart düzeni (mobil-first). */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
        ) : (
          rows.map((row) => (
            <MobilePartRow
              key={row.id}
              row={row}
              locked={locked}
              vehicle={vehicle}
              onCell={onCell}
              onRemove={removeRow}
              onClear={clearRow}
            />
          ))
        )}
      </div>

      {!locked && (
        <Button type="button" size="sm" variant="outline" onClick={addDraft} className="w-full sm:w-auto" disabled={loading}>
          <Plus className="size-3.5 mr-1" /> Yeni satır
        </Button>
      )}
    </div>
    </PartAttrOptionsProvider>
  )
}

// ── Satır-editör paylaşılan mantığı ─────────────────────────────────────────
// Masaüstü <tr> ve mobil kart aynı state/işleyicileri bu hook'tan alır.
function useRowEditor(row: Row, vehicle: PickerVehicle | undefined, locked: boolean, onCell: OnCell) {
  const isPart = row.type === "part"
  const editable = !locked
  const linked = vehicle?.catalogVehicleTypeId != null
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)
  const [filter, setFilter] = useState<PartFilter>({})

  // Katalog parçasından satırı doldur: ad/SKU/marka/kategori tek seferde.
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

  return {
    isPart, editable, linked, filter, setFilter,
    editingPrice, setEditingPrice, priceDraft, setPriceDraft,
    tecdocOpen, setTecdocOpen, fillFromArticle, lineTotal, startPrice, commitPrice,
  }
}

type RowEditor = ReturnType<typeof useRowEditor>

// ── Layout-bağımsız hücre içerikleri (masaüstü + mobil ortak) ────────────────

function PartField({ row, ed, vehicle, onCell, onClear }: {
  row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell; onClear: (row: Row) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {ed.isPart ? (
        <PartSearchInput
          value={row.name}
          sku={row.sku}
          vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
          supplierId={ed.filter.supplierId ?? null}
          categoryId={ed.filter.categoryId ?? null}
          disabled={!ed.editable || row.__saving}
          placeholder="Parça no veya adı"
          onNameChange={(name) => onCell(row, { name }, { localOnly: true })}
          onSelectArticle={ed.fillFromArticle}
          onCommit={() => { if (row.name.trim()) onCell(row, { name: row.name }) }}
          onClear={() => { onClear(row); ed.setFilter({}) }}
          showClear={ed.editable && !!(row.name || row.sku || row.brand || row.category || row.categoryId)}
          onSearchClick={() => ed.setTecdocOpen(true)}
          searchDisabled={vehicle?.catalogVehicleTypeId == null}
          searchTitle={vehicle?.catalogVehicleTypeId == null ? "Araç TecDoc'ta eşleşmedi" : "TecDoc kataloğundan seç"}
        />
      ) : (
        <Input
          value={row.name}
          onChange={(e) => onCell(row, { name: e.target.value }, { debounce: true })}
          onBlur={() => { if (row.__draft && row.name.trim()) onCell(row, {}) }}
          placeholder="İşçilik adı"
          disabled={!ed.editable || row.__saving}
          className="text-sm"
        />
      )}
      {row.__saving && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  )
}

function QtyStepper({ row, editable, onCell }: { row: Row; editable: boolean; onCell: OnCell }) {
  return (
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
  )
}

function PriceField({ row, ed }: { row: Row; ed: RowEditor }) {
  if (ed.editingPrice) {
    return (
      <Input type="number" min="0" step="0.01" autoFocus value={ed.priceDraft}
        onChange={(e) => ed.setPriceDraft(e.target.value)} onBlur={ed.commitPrice}
        onKeyDown={(e) => { if (e.key === "Enter") ed.commitPrice(); if (e.key === "Escape") ed.setEditingPrice(false) }}
        className="h-8 w-24 text-xs" />
    )
  }
  return (
    <Button type="button" variant="outline" disabled={!ed.editable}
      onClick={() => ed.editable && ed.startPrice()} className="gap-1 font-normal">
      <Pencil className="size-3 text-muted-foreground" />
      <span className={cn("tabular-nums", row.unitPrice == null && "text-muted-foreground")}>
        {row.unitPrice != null ? formatTRY(row.unitPrice) : "Fiyat"}
      </span>
    </Button>
  )
}

function TotalField({ lineTotal }: { lineTotal: number | null }) {
  return (
    <span className={cn("text-sm font-semibold tabular-nums", lineTotal == null ? "text-xs font-normal text-muted-foreground/70" : "text-foreground")}>
      {lineTotal != null ? formatTRY(lineTotal) : "—"}
    </span>
  )
}

function DeleteButton({ row, onRemove }: { row: Row; onRemove: (row: Row) => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(row)}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Satırı sil">
      <Trash2 className="size-4" />
    </Button>
  )
}

// TecDoc modal — yalnız part satırı VE araç TecDoc'ta eşleşmişse mount edilir
// (eşleşmemişse picker VinLinkPrompt döner; 🔍 butonu zaten disabled). Portal
// ile render olduğu için <td>/kart içine yerleştirmek güvenli.
function RowTecdocPicker({ row, ed, vehicle, onCell }: {
  row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell
}) {
  if (!(ed.isPart && ed.editable && vehicle?.catalogVehicleTypeId != null)) return null
  return (
    <TecdocPartPicker
      vehicle={vehicle}
      hideTrigger
      open={ed.tecdocOpen}
      onOpenChange={ed.setTecdocOpen}
      initialCategoryId={row.categoryId ?? ed.filter.categoryId ?? null}
      initialCategoryName={row.category ?? ed.filter.categoryName ?? null}
      initialSupplierId={row.brandSupplierId ?? ed.filter.supplierId ?? null}
      initialSupplierName={row.brand ?? ed.filter.supplierName ?? null}
      onSelect={(sel) => {
        onCell(row, { name: sel.name, sku: sel.articleNo, brand: sel.supplierName, category: sel.categoryName || null, categoryId: sel.categoryId || null })
        ed.setFilter({
          supplierName: sel.supplierName || undefined,
          categoryId: sel.categoryId ?? undefined,
          categoryName: sel.categoryName || undefined,
        })
        ed.setTecdocOpen(false)
      }}
    />
  )
}

// Marka/Kategori hücresi (masaüstü + mobil ortak). Düzenlenebilirken katalog
// önerili + serbest-metin Autocomplete; kilitliyken salt-görünür etiket.
// Seçim/serbest-commit satıra persist EDER (onCell) ve katalog seçimi ayrıca
// parça aramasını daraltan filtreyi (ed.filter) set eder.
function AttrCell({ kind, row, ed, vehicle, onCell }: {
  kind: "brand" | "category"; row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell
}) {
  if (!ed.isPart) return null
  const value = kind === "brand" ? row.brand : row.category

  if (!ed.editable) {
    return value ? (
      <span className="block truncate text-xs text-muted-foreground" title={value}>{value}</span>
    ) : (
      <span className="text-xs text-muted-foreground/40">—</span>
    )
  }

  return (
    <PartAttributeField
      kind={kind}
      vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
      value={value ?? ""}
      disabled={row.__saving}
      onSelect={(id, name) => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: id, supplierName: name }))
          onCell(row, { brand: name })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: id, categoryName: name }))
          onCell(row, { category: name, categoryId: id })
        }
      }}
      onCommitFreeText={(v) => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))
          onCell(row, { brand: v })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))
          onCell(row, { category: v, categoryId: null })
        }
      }}
      onClear={() => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))
          onCell(row, { brand: null })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))
          onCell(row, { category: null, categoryId: null })
        }
      }}
      onOpenPicker={ed.linked ? () => ed.setTecdocOpen(true) : undefined}
    />
  )
}

// ── Masaüstü satırı: gerçek <tr> ─────────────────────────────────────────────
function DesktopPartRow({ row, locked, vehicle, onCell, onRemove, onClear }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
  onClear: (row: Row) => void
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)

  return (
    <TableRow>
      {/* Tür */}
      <TableCell>
        {row.__draft && ed.editable ? (
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
      </TableCell>

      {/* Parça / İşçilik */}
      <TableCell className="whitespace-normal">
        <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onClear={onClear} />
        <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </TableCell>

      {/* Marka */}
      <TableCell className="whitespace-normal">
        <AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </TableCell>

      {/* Kategori */}
      <TableCell className="whitespace-normal">
        <AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </TableCell>

      {/* Miktar */}
      <TableCell>
        <div className="flex justify-center">
          <QtyStepper row={row} editable={ed.editable} onCell={onCell} />
        </div>
      </TableCell>

      {/* Birim Fiyat */}
      <TableCell>
        <div className="flex justify-end">
          <PriceField row={row} ed={ed} />
        </div>
      </TableCell>

      {/* Toplam */}
      <TableCell className="text-right">
        <TotalField lineTotal={ed.lineTotal} />
      </TableCell>

      {/* Sil */}
      <TableCell>
        <div className="flex justify-end">
          {ed.editable && <DeleteButton row={row} onRemove={onRemove} />}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Mobil satırı: kart ───────────────────────────────────────────────────────
function MobilePartRow({ row, locked, vehicle, onCell, onRemove, onClear }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
  onClear: (row: Row) => void
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)

  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      {/* Tür + sil */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        {row.__draft && ed.editable ? (
          <Select items={TYPE_LABELS} value={row.type} onValueChange={(v) => onCell(row, { type: v as ItemType })}>
            <SelectTrigger className="w-40 min-w-0 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="part">Yedek Parça</SelectItem>
              <SelectItem value="labor">İşçilik</SelectItem>
              <SelectItem value="external_labor">Dış İşçilik</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[row.type as ItemType] ?? row.type}</span>
        )}
        {ed.editable && <DeleteButton row={row} onRemove={onRemove} />}
      </div>

      {/* Parça / İşçilik */}
      <div className="mt-2">
        <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onClear={onClear} />
        <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </div>

      {/* Marka / Kategori — mobilde de düzenlenebilir (AttrCell ortak hücre). */}
      {ed.isPart && (ed.editable || row.brand || row.category) && (
        <div className="mt-2 space-y-1.5">
          {(ed.editable || row.brand) && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">Marka</span>
              <div className="min-w-0 flex-1">
                <AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
              </div>
            </div>
          )}
          {(ed.editable || row.category) && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">Kategori</span>
              <div className="min-w-0 flex-1">
                <AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Miktar */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Miktar</span>
        <QtyStepper row={row} editable={ed.editable} onCell={onCell} />
      </div>

      {/* Birim Fiyat */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Birim Fiyat</span>
        <PriceField row={row} ed={ed} />
      </div>

      {/* Toplam */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Toplam</span>
        <TotalField lineTotal={ed.lineTotal} />
      </div>
    </div>
  )
}
