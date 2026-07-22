"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Minus, Trash2, Loader2, Pencil, PackagePlus, PencilLine, Tags, PackageCheck, Wrench, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { getMockLaborCatalog, searchLaborCatalog, type LaborCatalogEntry } from "@/lib/labor/mock-labor-catalog"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/app/order-management-panel"
import { PartSearchInput } from "@/components/app/part-search-input"
import { PartAttributeField } from "@/components/app/part-attribute-field"
import { TecdocPartPicker, type PickerVehicle } from "@/components/app/tecdoc-part-picker"
import { PartAttrOptionsProvider } from "@/components/app/part-attr-options"
import { SupplierPriceDialog } from "@/components/app/supplier-price-dialog"
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

// Composer'ın boş taslağı (tek satırlık ekleme formu için — listede birikmez).
// source: kalemin kaynağı (katalog composer → "catalog", manuel → "manual").
function emptyDraft(type: ItemType, source: "catalog" | "manual"): Row {
  return {
    id: "composer", type, name: "", sku: null, unit: "adet",
    quantity: 1, unitPrice: null, totalPrice: null, note: null, brand: null, category: null, categoryId: null,
    source,
  }
}

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
  const linked = vehicle?.catalogVehicleTypeId != null
  const [rows, setRows] = useState<Row[]>(items.map(toRow))
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Sunucu items'ı yerele senkronla. Runtime-only brandSupplierId (persist
  // EDİLMEZ) önceki satırdan id ile taşınır ki marka→kategori filtresi
  // router.refresh() sonrası da (tam yeniden yüklemeye kadar) yaşasın.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => {
      const prevById = new Map(prev.map((r) => [r.id, r]))
      return items.map((i) => {
        const prevRow = prevById.get(i.id)
        return prevRow ? { ...toRow(i), brandSupplierId: prevRow.brandSupplierId } : toRow(i)
      })
    })
  }, [items])

  useEffect(() => {
    const timers = saveTimers.current
    return () => { Object.values(timers).forEach((t) => clearTimeout(t)) }
  }, [])

  function patchLocal(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  // Composer'dan gelen taslağı TEK POST ile ekle. Başarıda optimistik olarak
  // listeye ekler + router.refresh() ile sunucudan doğrular. true dönerse
  // composer kendini sıfırlar.
  async function addItem(draft: Row): Promise<boolean> {
    if (!draft.name.trim()) return false
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", draft.type)
    fd.set("name", draft.name.trim())
    if (draft.sku) fd.set("sku", draft.sku)
    if (draft.unit) fd.set("unit", draft.unit)
    fd.set("quantity", String(draft.quantity))
    if (draft.unitPrice != null) fd.set("unitPrice", String(draft.unitPrice))
    if (draft.brand) fd.set("brand", draft.brand)
    if (draft.category) fd.set("category", draft.category)
    if (draft.categoryId != null) fd.set("categoryId", String(draft.categoryId))
    if (draft.source) fd.set("source", draft.source)
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.id) {
        const realId: string = data.id
        setRows((prev) => [
          ...prev,
          { ...toRow(draft), id: realId, __draft: false, brandSupplierId: draft.brandSupplierId },
        ])
        router.refresh()
        return true
      }
      onError(data.error || "Kalem eklenemedi")
      return false
    } catch {
      onError("Bir hata oluştu")
      return false
    }
  }

  // Kalıcı satır hücre patch'i (debounce'lu, alan-bazlı anahtar).
  function persistUpdate(rowId: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) {
    // Boş ad'ı sunucuya GÖNDERME: sunucu min(1) ile reddedip satırı eski adına
    // revert ediyordu. Ad yalnız yerelde boşaltılır; dolu ad yazılınca PATCH gider.
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

  // Listedeki kalıcı satırın hücre değişimi: yereli güncelle + PATCH.
  // opts.localOnly: yalnız yerel (katalog arama kutusuna YAZARKEN; kalıcılık seçimde).
  const onCell: OnCell = (row, patch, opts) => {
    patchLocal(row.id, patch)
    if (opts?.localOnly) return
    persistUpdate(row.id, patch, opts)
  }

  async function removeRow(row: Row) {
    try {
      await fetch(`/api/orders/items?id=${row.id}&orderId=${orderId}`, { method: "DELETE" })
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      router.refresh()
    } catch { onError("Kalem silinemedi") }
  }

  const headCls = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

  return (
    <PartAttrOptionsProvider vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}>
    <TooltipProvider>
    <div className="space-y-4">
      {/* Ekleme alanı: tab'lı composer (katalog / manuel). Satır biriktirmez —
          "Ekle" ile aşağıdaki listeye düşürür ve sıfırlanır. Kilitli emirde gizli. */}
      {!locked && (
        <Tabs defaultValue={linked ? "katalog" : "manuel"}>
          <TabsList variant="line" className="w-full flex-nowrap gap-1 border-b border-border pb-0 -mb-px sm:gap-2">
            <TabsTrigger value="katalog" className="px-3 py-2 shrink-0">
              <PackagePlus className="size-4" /> Katalogdan Parça
            </TabsTrigger>
            <TabsTrigger value="manuel" className="px-3 py-2 shrink-0">
              <PencilLine className="size-4" /> Manuel Parça
            </TabsTrigger>
            <TabsTrigger value="iscilik" className="px-3 py-2 shrink-0">
              <Wrench className="size-4" /> İşçilik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="katalog" className="pt-3">
            <CatalogComposer vehicle={vehicle} onAdd={addItem} disabled={loading} />
          </TabsContent>
          <TabsContent value="manuel" className="pt-3">
            <ManualComposer onAdd={addItem} disabled={loading} />
          </TabsContent>
          <TabsContent value="iscilik" className="pt-3">
            <LaborComposer onAdd={addItem} disabled={loading} />
          </TabsContent>
        </Tabs>
      )}

      {!locked && <Separator />}

      {/* Ortak çarşaf liste: her iki tab'dan eklenen kalemler. Düzenle + sil. */}
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
            />
          ))
        )}
      </div>
    </div>
    </TooltipProvider>
    </PartAttrOptionsProvider>
  )
}

// ── Composer: küçük alan etiketi ─────────────────────────────────────────────
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

// ── Composer ortak footer: Miktar + Birim Fiyat (tek hizalı blok) + Toplam +
// Ekle. Alanlar açıklayıcı grid'in DIŞINDA sabit bir satırda tutulur → miktar/
// fiyat artık alan sayısına göre alt satıra kaymaz (eski layout hatası).
function ComposerFooter({ draft, ed, onCell, onSubmit, submitting, disabled }: {
  draft: Row; ed: RowEditor; onCell: OnCell; onSubmit: () => void; submitting: boolean; disabled: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-end gap-3">
        <Field label="Miktar">
          <QtyStepper row={draft} editable onCell={onCell} />
        </Field>
        <Field label="Birim Fiyat">
          <PriceField row={draft} ed={ed} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <TotalPreview lineTotal={ed.lineTotal} />
        <Button type="button" size="sm" onClick={onSubmit} disabled={disabled || submitting || !draft.name.trim()}>
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Ekle
        </Button>
      </div>
    </div>
  )
}

// İki-düğmeli segment: İşçilik composer'ında İç / Dış işçilik modu.
function LaborModeToggle({ mode, onChange, disabled }: {
  mode: "labor" | "external_labor"; onChange: (m: "labor" | "external_labor") => void; disabled: boolean
}) {
  const opts: Array<{ value: "labor" | "external_labor"; label: string; Icon: typeof Wrench }> = [
    { value: "labor", label: "İç İşçilik", Icon: Wrench },
    { value: "external_labor", label: "Dış İşçilik", Icon: ExternalLink },
  ]
  return (
    <div className="inline-flex rounded-lg border border-input bg-muted/40 p-0.5">
      {opts.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? "default" : "ghost"}
          disabled={disabled}
          onClick={() => onChange(value)}
          className={cn("gap-1.5", mode !== value && "text-muted-foreground")}
        >
          <Icon className="size-3.5" /> {label}
        </Button>
      ))}
    </div>
  )
}

// İç işçilik ad alanı: serbest-metin Autocomplete + mock katalog önerileri.
// Yazdıkça searchLaborCatalog önerir; öneri seçilince ad+önerilen fiyat dolar;
// serbest metin de yazılabilir (kendi işçilik kalemi — fiyat elle girilir).
function LaborAutocompleteField({ draft, onCell, disabled }: {
  draft: Row; onCell: OnCell; disabled: boolean
}) {
  const items = useMemo(() => searchLaborCatalog(draft.name), [draft.name])
  return (
    <Autocomplete
      items={items}
      value={draft.name}
      filter={null}
      autoHighlight
      openOnInputClick
      itemToStringValue={(e: LaborCatalogEntry) => e.name}
      onValueChange={(v: string) => {
        // Ad, tanımlı (mock) bir işçiliğe birebir eşleşiyorsa önerilen fiyatı taşı;
        // eşleşme bozulunca/temizlenince fiyatı da düşür ki seçili katalog fiyatı
        // özel/serbest kaleme sızmasın (spec: temizlenince unitPrice=null).
        const match = getMockLaborCatalog().find((e) => e.name === v)
        onCell(draft, { name: v, unitPrice: match ? match.defaultPriceKurus : null })
      }}
    >
      <AutocompleteInput
        render={
          <Input
            placeholder="İşçilik ara veya kendi kalemini yaz"
            disabled={disabled}
            title={draft.name || undefined}
            className="text-sm"
          />
        }
      />
      <AutocompleteContent>
        <AutocompleteEmpty>Tanımlı işçilik yok — kendi kaleminizi yazabilirsiniz</AutocompleteEmpty>
        <AutocompleteList>
          {(e: LaborCatalogEntry) => (
            <AutocompleteItem
              key={e.id}
              value={e}
              onClick={() => onCell(draft, { name: e.name, unitPrice: e.defaultPriceKurus })}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {e.category} · {formatTRY(e.defaultPriceKurus)}
                </span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}

// ── İşçilik composer: İç (mock öneri + serbest) / Dış (serbest) işçilik.
// mode+nonce anahtarıyla remount → mod değişince ve her eklemede yerel state
// (draft, arama kutusu) temiz sıfırlanır.
function LaborComposer({ onAdd, disabled }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  const [mode, setMode] = useState<"labor" | "external_labor">("labor")
  return (
    <div className="space-y-3">
      <LaborModeToggle mode={mode} onChange={setMode} disabled={disabled} />
      <LaborComposerBody
        key={`${mode}-${nonce}`}
        mode={mode}
        onAdd={onAdd}
        disabled={disabled}
        onAdded={() => setNonce((n) => n + 1)}
      />
    </div>
  )
}

function LaborComposerBody({ mode, onAdd, disabled, onAdded }: {
  mode: "labor" | "external_labor"; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft(mode, "manual"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  // İşçilikte araç bağı yok; useRowEditor yalnız fiyat/toplam mantığı için.
  const ed = useRowEditor(draft, undefined, false, onCell)
  const isExternal = mode === "external_labor"

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    // Tanımlı (mock) işçilik adına birebir eşleşme → catalog rozeti; değilse manuel.
    const isDefined = mode === "labor" && getMockLaborCatalog().some((e) => e.name === draft.name.trim())
    const ok = await onAdd({ ...draft, source: isDefined ? "catalog" : "manual" })
    if (ok) onAdded()
    else setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={isExternal ? "Dış İşçilik" : "İşçilik"} className="sm:col-span-2 lg:col-span-4">
          {isExternal ? (
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Dış işçilik adı (ör. dış atölye kaporta)"
              title={draft.name || undefined}
              disabled={disabled}
              className="text-sm"
            />
          ) : (
            <LaborAutocompleteField draft={draft} onCell={onCell} disabled={disabled} />
          )}
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}

// ── Katalog composer: Parça (canlı TecDoc arama). nonce anahtarıyla remount →
// her eklemede yerel state (draft, arama kutusu, autocomplete) temiz sıfırlanır.
// Kaynak = "catalog".
function CatalogComposer({ vehicle, onAdd, disabled }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  return (
    <CatalogComposerBody
      key={nonce}
      vehicle={vehicle}
      onAdd={onAdd}
      disabled={disabled}
      onAdded={() => setNonce((n) => n + 1)}
    />
  )
}

function CatalogComposerBody({ vehicle, onAdd, disabled, onAdded }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft("part", "catalog"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  const ed = useRowEditor(draft, vehicle, false, onCell)

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    const ok = await onAdd(draft)
    if (ok) onAdded() // remount → sıfırla
    else setSubmitting(false)
  }

  const clearPart = () => {
    setDraft((d) => ({ ...d, name: "", sku: null, brand: null, category: null, categoryId: null }))
    ed.setFilter({})
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parça" className="sm:col-span-2 lg:col-span-2">
          <PartField row={draft} ed={ed} vehicle={vehicle} onCell={onCell} onClear={clearPart} />
          <RowTecdocPicker row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
        <Field label="Marka">
          <AttrCell kind="brand" row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
        <Field label="Kategori">
          <AttrCell kind="category" row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}

// ── Manuel composer: serbest metin parça girişi (katalog araması YOK). İşçilik
// artık ayrı "İşçilik" sekmesinde; bu sekme yalnız parça ekler.
// Kaynak = "manual".
function ManualComposer({ onAdd, disabled }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  return (
    <ManualComposerBody
      key={nonce}
      onAdd={onAdd}
      disabled={disabled}
      onAdded={() => setNonce((n) => n + 1)}
    />
  )
}

function ManualComposerBody({ onAdd, disabled, onAdded }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft("part", "manual"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  // vehicle=undefined → katalog picker kapalı, saf serbest metin (marka/kategori
  // önerileri context'ten hâlâ gelir — araç bağlıysa yardımcı olur).
  const ed = useRowEditor(draft, undefined, false, onCell)

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    const ok = await onAdd(draft)
    if (ok) onAdded()
    else setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parça adı" className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Parça adı"
            title={draft.name || undefined}
            className="text-sm"
          />
        </Field>
        <Field label="Marka">
          <AttrCell kind="brand" row={draft} ed={ed} onCell={onCell} />
        </Field>
        <Field label="Kategori">
          <AttrCell kind="category" row={draft} ed={ed} onCell={onCell} />
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}

function TotalPreview({ lineTotal }: { lineTotal: number | null }) {
  if (lineTotal == null) return null
  return (
    <span className="text-sm text-muted-foreground">
      Toplam: <span className="font-semibold tabular-nums text-foreground">{formatTRY(lineTotal)}</span>
    </span>
  )
}

// ── Satır-editör paylaşılan mantığı ─────────────────────────────────────────
// Masaüstü <tr>, mobil kart VE composer aynı state/işleyicileri bu hook'tan alır.
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

// ── Layout-bağımsız hücre içerikleri (masaüstü + mobil + composer ortak) ─────

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
          placeholder="İşçilik adı"
          disabled={!ed.editable || row.__saving}
          className="text-sm"
        />
      )}
      {ed.isPart && row.name.trim() !== "" && (
        <PartPriceCompare row={row} ed={ed} onCell={onCell} />
      )}
      {row.__saving && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  )
}

// Tedarikçi fiyat karşılaştırma tetikleyicisi + popup (mock veri). Yalnız parça
// satırında VE ad doluyken PartField'de mount edilir → masaüstü <tr> ve mobil
// kart aynı bileşeni paylaşır. Fiyat uygula → satırın Birim Fiyat'ına yazar.
function PartPriceCompare({ row, ed, onCell }: { row: Row; ed: RowEditor; onCell: OnCell }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        className="shrink-0 text-muted-foreground hover:text-primary"
        aria-label="Tedarikçi fiyatlarını karşılaştır"
        title="Tedarikçi fiyatlarını karşılaştır"
      >
        <Tags className="size-4" />
      </Button>
      <SupplierPriceDialog
        open={open}
        onOpenChange={setOpen}
        part={{ name: row.name, sku: row.sku, brand: row.brand }}
        editable={ed.editable}
        onApply={(priceKurus) => onCell(row, { unitPrice: priceKurus })}
      />
    </>
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

// Kalemin kaynağını gösteren küçük rozet: katalog vs manuel. Tooltip masaüstünde
// hover, mobilde dokun(focus)-ile açılır. source=null (eski satır) → rozet yok.
function SourceBadge({ source }: { source: OrderItem["source"] }) {
  if (!source) return null
  const isCatalog = source === "catalog"
  const Icon = isCatalog ? PackageCheck : PencilLine
  const label = isCatalog ? "Katalogdan eklendi" : "Manuel eklendi"
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
          isCatalog ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
// ile render olduğu için <td>/kart/composer içine yerleştirmek güvenli.
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

// Marka/Kategori hücresi (masaüstü + mobil + composer ortak). Düzenlenebilirken
// katalog önerili + serbest-metin Autocomplete; kilitliyken salt-görünür etiket.
function AttrCell({ kind, row, ed, vehicle, onCell }: {
  kind: "brand" | "category"; row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell
}) {
  if (!ed.isPart) return null
  const value = kind === "brand" ? row.brand : row.category

  if (!ed.editable) {
    // Salt-görünür (kilitli emir): truncate YERİNE sar → mobil/masaüstü tam metin.
    return value ? (
      <span className="block whitespace-normal break-words text-xs text-muted-foreground" title={value}>{value}</span>
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

// ── Masaüstü satırı: gerçek <tr> (çarşaf liste) ──────────────────────────────
function DesktopPartRow({ row, locked, vehicle, onCell, onRemove }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)

  return (
    <TableRow>
      {/* Tür (listede salt-görünür — tür composer'da seçilir) */}
      <TableCell>
        <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[row.type as ItemType] ?? row.type}</span>
      </TableCell>

      {/* Parça / İşçilik — kaynak rozeti + alan */}
      <TableCell className="whitespace-normal">
        <div className="flex items-center gap-1.5">
          <SourceBadge source={row.source} />
          <div className="min-w-0 flex-1">
            <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onClear={onRemove} />
            <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
          </div>
        </div>
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

// ── Mobil satırı: kart (çarşaf liste) ────────────────────────────────────────
function MobilePartRow({ row, locked, vehicle, onCell, onRemove }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)

  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      {/* Tür + kaynak rozeti + sil */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[row.type as ItemType] ?? row.type}</span>
          <SourceBadge source={row.source} />
        </div>
        {ed.editable && <DeleteButton row={row} onRemove={onRemove} />}
      </div>

      {/* Parça / İşçilik */}
      <div className="mt-2">
        <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onClear={onRemove} />
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
