"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Plus, Minus, Trash2, Loader2, PackagePlus, PencilLine, Tags, PackageCheck, Wrench, ShoppingCart, ExternalLink, CheckCircle2, PackageSearch, Info, Check } from "lucide-react"
import { PurchaseDetailDialog } from "@/components/purchases/purchase-detail-dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import { searchLaborItems } from "@/lib/labor/search"
import type { LaborCatalogRow } from "@/lib/labor/types"
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
import type { OrderItem } from "@/components/orders/order-management-panel"
import { PartSearchInput } from "@/components/parts/part-search-input"
import { PartAttributeField } from "@/components/parts/part-attribute-field"
import { TecdocPartPicker, type PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import { VinLinkPrompt } from "@/components/parts/vin-link-prompt"
import { PartAttrOptionsProvider } from "@/components/parts/part-attr-options"
import { SupplierPriceDialog } from "@/components/parts/supplier-price-dialog"
import { ManualPartDialog, type ManualPartDraft } from "@/components/parts/manual-part-dialog"
import { PartDetailDialog, type PartDetailTarget } from "@/components/parts/part-detail-dialog"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import { ensureVehiclePartsPrefetched } from "@/app/(app)/parts/actions"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

// brandSupplierId: yalnız runtime — marka→kategori best-effort filtresi için
// seçili markanın TecDoc supplierId'sini taşır; ASLA persist edilmez.
type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string; brandSupplierId?: number | null }

// Satır-yerel arama filtresi (persist EDİLMEZ). Combobox seçimi buraya yazar;
// parça seçilince senkronlanır; satır temizlenince sıfırlanır.
type PartFilter = { supplierId?: number; supplierName?: string; categoryId?: number; categoryName?: string }

type OnCell = (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean; localOnly?: boolean }) => void

/**
 * Parça detay modalı açma isteği. Modal TEK örnek olarak PartsLaborGrid'de durur
 * (Autocomplete popup'ının içinde Dialog render etmek odak/portal çakışması
 * yaratıyor); açan taraf hedefi ve — seçim bağlamındaysa — seçme eylemini verir.
 */
type DetailRequest = { target: PartDetailTarget; onSelect?: () => void }
type OnShowDetail = (req: DetailRequest) => void

/** Katalog parçası (arama sonucu / picker satırı) → modal hedefi. */
function toDetailTarget(
  a: { tecdocArticleId: number; productName: string; articleNo: string; supplierName: string },
  vehicle?: PickerVehicle
): PartDetailTarget {
  return {
    tecdocArticleId: a.tecdocArticleId,
    productName: a.productName,
    articleNo: a.articleNo,
    supplierName: a.supplierName,
    vehicleTypeId: vehicle?.catalogVehicleTypeId ?? null,
  }
}

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
  orderId, status, items, vehicle, onError, loading, laborCatalog,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: PickerVehicle
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
  laborCatalog: LaborCatalogRow[]
}) {
  const router = useRouter()
  const locked = isOrderLocked(status as OrderStatus)
  const [rows, setRows] = useState<Row[]>(items.map(toRow))
  // Parça detay modalı (tek örnek) — arama, katalog picker'ı ve kalem satırları besler.
  const [detail, setDetail] = useState<DetailRequest | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Sessiz otosave'i görünür kılan geçici "✓ Kaydedildi" işareti: başarılı
  // PATCH sonrası ilgili satırda 2 sn gösterilir (tecrübesiz kullanıcı için
  // "değişikliğim kaydoldu mu?" belirsizliğini kaldırır).
  const [savedRowId, setSavedRowId] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flashSaved(rowId: string) {
    setSavedRowId(rowId)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedRowId(null), 2000)
  }

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
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t))
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
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
    // Katalog bağlantısı: satırda "Parça detayı" (ⓘ) ancak bu id ile açılabilir.
    if (draft.tecdocArticleId != null) fd.set("tecdocArticleId", String(draft.tecdocArticleId))
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
      if (patch.tecdocArticleId !== undefined)
        fd.set("tecdocArticleId", patch.tecdocArticleId != null ? String(patch.tecdocArticleId) : "")
      if (patch.name !== undefined) fd.set("name", patch.name)
      if (patch.unit !== undefined) fd.set("unit", patch.unit ?? "")
      try {
        const res = await fetch(`/api/orders/items?id=${rowId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) { onError(data.error || "Kalem güncellenemedi"); setRows(items.map(toRow)) }
        else { flashSaved(rowId); router.refresh() }
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
        <Tabs defaultValue="parca">
          <TabsList variant="line" className="w-full flex-nowrap gap-1 border-b border-border pb-0 -mb-px sm:gap-2">
            <TabsTrigger value="parca" className="px-3 py-2 shrink-0">
              <PackagePlus className="size-4" /> Parça
            </TabsTrigger>
            <TabsTrigger value="iscilik" className="px-3 py-2 shrink-0">
              <Wrench className="size-4" /> İşçilik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parca" className="pt-4">
            <ComposerCard>
              <UnifiedPartComposer vehicle={vehicle} onAdd={addItem} disabled={loading} onShowDetail={setDetail} />
            </ComposerCard>
          </TabsContent>
          <TabsContent value="iscilik" className="pt-4">
            <ComposerCard><LaborComposer onAdd={addItem} disabled={loading} catalog={laborCatalog} /></ComposerCard>
          </TabsContent>
        </Tabs>
      )}

      {!locked && <Separator />}

      {/* Ortak çarşaf liste: her iki tab'dan eklenen kalemler. Düzenle + sil. */}
      {/* Masaüstü (md+): gerçek shadcn Base <table> — dar ekranda yatay kaydırır. */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table className="min-w-[52rem] table-fixed">
          <colgroup>
            <col className="w-40" />{/* Tür */}
            <col />{/* Parça / İşçilik + Marka/Kategori meta (kalan alan) */}
            <col className="w-24" />{/* Miktar */}
            <col className="w-36" />{/* Birim Fiyat */}
            <col className="w-28" />{/* Toplam */}
            <col className="w-12" />{/* Sil */}
          </colgroup>
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(headCls, "pl-[18px]")}>Tür</TableHead>
              <TableHead className={headCls}>Parça / İşçilik</TableHead>
              <TableHead className={cn(headCls, "text-center")}>Miktar</TableHead>
              <TableHead className={cn(headCls, "text-right")}>Birim Fiyat</TableHead>
              <TableHead className={cn(headCls, "text-right")}>Toplam</TableHead>
              <TableHead className={cn(headCls, "text-right")}><span className="sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyItemsHint locked={locked} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <DesktopPartRow
                  key={row.id}
                  row={row}
                  orderId={orderId}
                  locked={locked}
                  vehicle={vehicle}
                  onCell={onCell}
                  onRemove={removeRow}
                  saved={savedRowId === row.id}
                  onShowDetail={setDetail}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobil (<md): kart düzeni (mobil-first). */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <EmptyItemsHint locked={locked} />
        ) : (
          rows.map((row) => (
            <MobilePartRow
              key={row.id}
              row={row}
              orderId={orderId}
              locked={locked}
              vehicle={vehicle}
              onCell={onCell}
              onRemove={removeRow}
              saved={savedRowId === row.id}
              onShowDetail={setDetail}
            />
          ))
        )}
      </div>

      {/* Parça detayı — TEK örnek; arama dropdown'ı, katalog picker'ı ve kalem
          satırları buraya `setDetail` ile istek gönderir. */}
      <PartDetailDialog
        target={detail?.target ?? null}
        onOpenChange={(open) => { if (!open) setDetail(null) }}
        onSelect={detail?.onSelect}
      />
    </div>
    </TooltipProvider>
    </PartAttrOptionsProvider>
  )
}

// ── Composer "ekleme kartı" kabuğu: composer'ı listeden görsel olarak ayıran,
// hafif marka-tintli, "Yeni kalem ekle" etiketli belirgin alan.
function ComposerCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-border bg-gradient-to-b from-primary/[0.06] to-transparent p-4 pt-5">
      <span className="absolute -top-2 left-4 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        Yeni kalem ekle
      </span>
      {children}
    </div>
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

// Composer'ın belirgin birincil "Ekle" CTA'sı. Masaüstünde satır-içi (auto);
// mobilde tam genişlik → dokunma hedefi büyük, aksiyon net.
function AddButton({ draft, onSubmit, submitting, disabled }: {
  draft: Row; onSubmit: () => void; submitting: boolean; disabled: boolean
}) {
  return (
    <Button type="button" size="default" onClick={onSubmit}
      disabled={disabled || submitting || !draft.name.trim()}
      className="w-full sm:w-auto">
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      Ekle
    </Button>
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

// İç işçilik ad alanı: serbest-metin Autocomplete + atölyenin kendi işçilik
// tanımlarından öneriler. Öneri seçilince ad + varsayılan ücret dolar; serbest
// metin de yazılabilir (katalogda olmayan işçilik — fiyat elle girilir).
function LaborAutocompleteField({ draft, onCell, disabled, catalog }: {
  draft: Row; onCell: OnCell; disabled: boolean; catalog: LaborCatalogRow[]
}) {
  const items = useMemo(() => searchLaborItems(catalog, draft.name), [catalog, draft.name])
  return (
    <Autocomplete
      items={items}
      value={draft.name}
      filter={null}
      autoHighlight
      openOnInputClick
      itemToStringValue={(e: LaborCatalogRow) => e.name}
      onValueChange={(v: string) => {
        // Ad tanımlı bir işçiliğe birebir eşleşiyorsa varsayılan ücreti taşı;
        // eşleşme bozulunca/temizlenince fiyatı da düşür ki katalog fiyatı
        // serbest kaleme sızmasın.
        const match = catalog.find((e) => e.name === v)
        onCell(draft, { name: v, unitPrice: match ? match.defaultPriceKurus : null })
      }}
    >
      <AutocompleteInput
        // Liste KAPALIYKEN Base UI Escape'te input değerini sessizce temizliyor
        // (bilinen tuzak, bkz. quote-create-form.tsx LaborNameAutocomplete) —
        // yazılan işçilik adı yok oluyor ve satır sessizce filtrelenip
        // kaybolabiliyor. Liste AÇIKKEN Escape'in listeyi kapatma davranışı
        // korunmalı, o yüzden yalnız kapalıyken susturuyoruz (aria-expanded=
        // "false").
        onKeyDown={(e) => {
          if (e.key === "Escape" && e.currentTarget.getAttribute("aria-expanded") !== "true") {
            e.preventBaseUIHandler()
          }
        }}
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
        <AutocompleteEmpty>
          Tanımlı işçilik yok — Stok / İşçilikler ekranından ekleyebilirsiniz
        </AutocompleteEmpty>
        <AutocompleteList>
          {(e: LaborCatalogRow) => (
            <AutocompleteItem
              key={e.id}
              value={e}
              onClick={() => onCell(draft, { name: e.name, unitPrice: e.defaultPriceKurus })}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {[e.category, e.defaultPriceKurus != null ? formatTRY(e.defaultPriceKurus) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}

// ── İşçilik composer: İç (katalog öneri + serbest) / Dış (serbest) işçilik.
// mode+nonce anahtarıyla remount → mod değişince ve her eklemede yerel state
// (draft, arama kutusu) temiz sıfırlanır.
function LaborComposer({ onAdd, disabled, catalog }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; catalog: LaborCatalogRow[]
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
        catalog={catalog}
      />
    </div>
  )
}

function LaborComposerBody({ mode, onAdd, disabled, onAdded, catalog }: {
  mode: "labor" | "external_labor"; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void; catalog: LaborCatalogRow[]
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
    // Atölyenin tanımlı işçiliğine birebir eşleşme → katalog rozeti; değilse manuel.
    const isDefined = mode === "labor" && catalog.some((e) => e.name === draft.name.trim())
    const ok = await onAdd({ ...draft, source: isDefined ? "catalog" : "manual" })
    if (ok) onAdded()
    else setSubmitting(false)
  }

  // Tek-satır inline composer (md+): [ad — esner] · Miktar · Birim Fiyat · Toplam ·
  // Ekle. Mobilde doğal olarak sarar (ad tam genişlik, sonra kontroller, Ekle CTA).
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Field label={isExternal ? "Dış İşçilik" : "İşçilik"} className="sm:flex-1 sm:min-w-[16rem]">
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
          <LaborAutocompleteField draft={draft} onCell={onCell} disabled={disabled} catalog={catalog} />
        )}
      </Field>
      <div className="flex items-end gap-3">
        <Field label="Miktar">
          <QtyStepper row={draft} editable onCell={onCell} />
        </Field>
        <Field label="Birim Fiyat">
          <PriceField row={draft} ed={ed} wide />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
        <TotalPreview lineTotal={ed.lineTotal} />
        <AddButton draft={draft} onSubmit={submit} submitting={submitting} disabled={disabled} />
      </div>
    </div>
  )
}

// ── Birleşik parça composer: saf Odoo-tarzı arama kutusu. Katalog eşleşmesi
// seçme / Oluştur "X" / Oluştur & Düzenle — hepsi doğrudan addItem çağırır.
// Satır anında listeye düşer; miktar/fiyat/marka/kategori satır-içinde düzenlenir.
// Başarılı eklemeden sonra kutu temizlenir + odak korunur (kontrollü value="").
function UnifiedPartComposer({ vehicle, onAdd, disabled, onShowDetail }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
  onShowDetail: OnShowDetail
}) {
  const [name, setName] = useState("")
  const [filter, setFilter] = useState<PartFilter>({})
  const [tecdocOpen, setTecdocOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const linked = vehicle?.catalogVehicleTypeId != null
  const [prefetching, setPrefetching] = useState(false)
  // Prefetch dolarken mevcut aramayı periyodik yeniden tetikleyen sinyal:
  // değeri her artışında PartSearchInput aynı query'yi yeniden sorgular.
  const [refreshSignal, setRefreshSignal] = useState(0)
  const prefetchStartedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = undefined
    }
    setPrefetching(false)
  }, [])

  // Güvenlik ağı: araç katalog-bağlı ama parça cache'i boşsa arka planda
  // doldur. Mount başına EN FAZLA bir kez (StrictMode çift-invoke'a karşı ref).
  useEffect(() => {
    if (!linked || !vehicle?.id || prefetchStartedRef.current) return
    prefetchStartedRef.current = true
    void ensureVehiclePartsPrefetched(vehicle.id)
      .then((res) => {
        if (res.status !== "started") return
        setPrefetching(true)
        // Prefetch ~20-40sn sürebilir ve arama YALNIZ query değişince çalışır;
        // bu yüzden mevcut aramayı ~3sn'de bir yeniden tetikle (refreshSignal),
        // veri düştükçe sonuçlar kendiliğinden belirsin. Sonuç gelince
        // (onResultsCount) ya da ~40sn üst sınırda dur.
        let ticks = 0
        pollRef.current = setInterval(() => {
          ticks += 1
          setRefreshSignal((n) => n + 1)
          if (ticks >= 13) stopPolling() // 13 × 3sn ≈ 40sn üst sınır
        }, 3000)
      })
      .catch(() => {})
    return () => stopPolling()
  }, [linked, vehicle?.id, stopPolling])

  // Arama sonucu geldiğinde prefetch poll'unu erken durdur + notu gizle.
  const handleResultsCount = useCallback(
    (count: number) => {
      if (count > 0) stopPolling()
    },
    [stopPolling],
  )

  /** Arama sonucu → kalem taslağı; hem satır seçimi hem detay modalı kullanır. */
  function catalogDraft(a: ArticleSearchResult): Partial<Row> & { source: "catalog" } {
    return {
      source: "catalog",
      name: a.productName,
      sku: a.articleNo,
      brand: a.supplierName || null,
      category: a.categoryName || null,
      categoryId: a.categoryId || null,
      tecdocArticleId: a.tecdocArticleId,
    }
  }

  // Tek ekleme yolu: emptyDraft üzerine partial'ı bindir → addItem. Başarıda kutuyu sıfırla.
  async function add(partial: Partial<Row> & { source: "catalog" | "manual" }): Promise<boolean> {
    if (submittingRef.current || !partial.name?.trim()) return false
    submittingRef.current = true
    setSubmitting(true)
    const ok = await onAdd({ ...emptyDraft("part", partial.source), ...partial, name: partial.name.trim() })
    submittingRef.current = false
    setSubmitting(false)
    if (ok) { setName(""); setFilter({}) }
    return ok
  }

  return (
    <div className="space-y-3">
      {!linked && (
        // Bağlama yolu burada da dursun: aksi hâlde katalogsuz araçta kullanıcı
        // "sınırlı" uyarısıyla baş başa kalıyor (VinLinkPrompt yalnız
        // TecdocPartPicker içinde ve o da `linked` iken basılıyordu).
        <div className="space-y-2 rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Araç katalogla eşleşmediği için katalog araması sınırlı — parçayı{" "}
            <span className="font-semibold text-foreground">Oluştur</span> ile elle ekleyebilirsiniz.
          </p>
          {vehicle && <VinLinkPrompt vehicle={vehicle} />}
        </div>
      )}

      <PartSearchInput
        value={name}
        sku={null}
        vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
        supplierId={filter.supplierId ?? null}
        categoryId={filter.categoryId ?? null}
        disabled={disabled}
        placeholder="Parça no, adı veya marka ara…"
        onNameChange={setName}
        onSelectArticle={(a) => void add(catalogDraft(a))}
        onShowDetail={(a) =>
          onShowDetail({ target: toDetailTarget(a, vehicle), onSelect: () => void add(catalogDraft(a)) })
        }
        onCommit={() => { if (name.trim()) void add({ source: "manual", name }) }}
        onClear={() => { setName(""); setFilter({}) }}
        showClear={!!name}
        onSearchClick={linked ? () => setTecdocOpen(true) : undefined}
        searchDisabled={!linked}
        searchTitle={linked ? "TecDoc kataloğundan seç" : "Araç TecDoc'ta eşleşmedi"}
        showCreate
        onCreate={(text) => void add({ source: "manual", name: text })}
        onCreateEdit={(text) => { setName(text); setDialogOpen(true) }}
        refreshSignal={refreshSignal}
        onResultsCount={handleResultsCount}
      />

      {prefetching && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Araca uygun parçalar hazırlanıyor…
        </p>
      )}

      {/* Tam TecDoc katalog picker (🔍) — yalnız araç kataloğa bağlıysa. */}
      {linked && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelect={(sel) => {
            void add({
              source: "catalog",
              name: sel.name,
              sku: sel.articleNo,
              brand: sel.supplierName,
              category: sel.categoryName || null,
              categoryId: sel.categoryId || null,
              tecdocArticleId: sel.tecdocArticleId,
            })
            setTecdocOpen(false)
          }}
          onShowDetail={(a) =>
            onShowDetail({
              target: toDetailTarget(a, vehicle),
              onSelect: () => {
                void add({
                  source: "catalog",
                  name: a.productName,
                  sku: a.articleNo,
                  brand: a.supplierName,
                  categoryId: null,
                  tecdocArticleId: a.tecdocArticleId,
                })
                setTecdocOpen(false)
              },
            })
          }
        />
      )}

      {/* Oluştur & Düzenle modalı. */}
      <ManualPartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={name}
        vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
        submitting={submitting}
        onSubmit={(d: ManualPartDraft) => {
          void add({
            source: "manual",
            name: d.name,
            brand: d.brand,
            category: d.category,
            categoryId: d.categoryId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
          }).then((ok) => { if (ok) setDialogOpen(false) })
        }}
      />
    </div>
  )
}

// Boş liste: pasif "kalem yok" metni yerine tecrübesiz kullanıcıyı doğru
// sekmeye yönlendiren boş durum (masaüstü tablo hücresi + mobil aynı bileşen).
function EmptyItemsHint({ locked }: { locked: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <PackageSearch className="size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">Henüz parça veya işçilik eklenmedi</p>
      {!locked && (
        <p className="text-xs text-muted-foreground">
          Yukarıdaki <span className="font-semibold text-foreground">Parça</span> kutusundan arayarak veya
          {" "}<span className="font-semibold text-foreground">Oluştur</span> ile ekleyerek başlayın
        </p>
      )}
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
  // Katalogdan (TecDoc) seçilmiş parçanın KİMLİĞİ kilitlidir: ad, parça no ve
  // marka katalog verisidir — elle değiştirilirse satır artık gerçek parçayı
  // göstermez (ⓘ detay, fiyat karşılaştırma, sipariş hep yanlış parçayı işaret
  // eder). Miktar/fiyat/kategori düzenlenebilir kalır. Sunucu da reddeder
  // (updateOrderItemAction). tecdocArticleId YALNIZ katalog seçiminde dolar.
  const identityLocked = isPart && row.tecdocArticleId != null
  const linked = vehicle?.catalogVehicleTypeId != null
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)
  const [filter, setFilter] = useState<PartFilter>({})

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
    isPart, editable, identityLocked, linked, filter, setFilter,
    editingPrice, setEditingPrice, priceDraft, setPriceDraft,
    tecdocOpen, setTecdocOpen, lineTotal, startPrice, commitPrice,
  }
}

type RowEditor = ReturnType<typeof useRowEditor>

// ── Layout-bağımsız hücre içerikleri (masaüstü + mobil + composer ortak) ─────

// Liste satırındaki parçanın salt-okunur kimliği: [parça no] + ad.
// Katalog parçasında veri katalogdan gelir → bozulmamalı. Manuel/dış alım
// kaleminde ise alan düzenlenebilir GÖRÜNÜP kaydedilmiyordu (katalog aramalı
// Autocomplete yalnız "sonuç yok + Enter" ile commit ediyor; blur'da yazılan ad
// sessizce eski haline dönüyordu) → yanıltıcı affordance kaldırıldı.
// Her iki durumda da ad hatalıysa satır silinip yeniden eklenir.
function PartIdentity({ row }: { row: Row }) {
  const title = row.tecdocArticleId != null
    ? "Katalogdan eklendi — ad, parça no ve marka değiştirilemez"
    : "Parça adı değiştirilemez — düzeltmek için satırı silip yeniden ekleyin"
  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 py-1"
      title={title}
    >
      {row.sku && (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
          {row.sku}
        </span>
      )}
      <span className="min-w-0 whitespace-normal break-words text-sm font-medium text-foreground">{row.name}</span>
    </div>
  )
}

// Liste satırının ad hücresi. Parçada ad SALT-OKUNUR (bkz. PartIdentity);
// işçilikte serbest metin olarak düzenlenebilir (debounce'lu otosave çalışıyor).
// Satır-içi aksiyonlar (parça detayı ⓘ, tedarikçi fiyat karşılaştırma) her
// durumda görünür.
function PartField({ row, ed, vehicle, onCell, onShowDetail }: {
  row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell
  onShowDetail: OnShowDetail
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {ed.isPart ? (
        <PartIdentity row={row} />
      ) : (
        <Input
          value={row.name}
          onChange={(e) => onCell(row, { name: e.target.value }, { debounce: true })}
          placeholder="İşçilik adı"
          disabled={!ed.editable || row.__saving}
          className="text-sm"
        />
      )}
      {/* Katalog bağlantılı kalem → özellik/görsel/uygunluk detayı. Eklemeden
          sonra da erişilebilir olmalı (usta parçayı takarken ölçüye bakıyor). */}
      {ed.isPart && row.tecdocArticleId != null && (
        <button
          type="button"
          aria-label="Parça detayı"
          title="Özellikler, görsel ve uygunluk"
          onClick={() =>
            onShowDetail({
              target: {
                tecdocArticleId: row.tecdocArticleId!,
                productName: row.name,
                articleNo: row.sku ?? "",
                supplierName: row.brand ?? "",
                vehicleTypeId: vehicle?.catalogVehicleTypeId ?? null,
              },
            })
          }
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-8"
        >
          <Info className="size-4" />
        </button>
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
      {/* İkon buton: liste satırının statik görünümünü bozmadan, "Parça detayı"
          (ⓘ) ile aynı ölçü/stilde ikinci satır-içi aksiyon. Mobilde de dokunma
          hedefi 36px kalsın diye size-9. */}
      <button
        type="button"
        data-slot="price-compare"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Tedarikçi fiyatlarını karşılaştır"
        title="Tedarikçi fiyatlarını karşılaştır"
      >
        <Tags className="size-4" />
      </button>
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
    <div data-slot="qty-stepper" className="inline-flex h-9 items-center rounded-lg border border-input bg-background transition-colors">
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

// wide: composer/mobil'de sabit geniş genişlik (dar/sıkışık görünmesin). Masaüstü
// tablo hücresinde (dar kolon) varsayılan kompakt genişlik korunur.
// Kalem-butonuna basıp açma deseni yerine HER ZAMAN yazılabilir ₺ alanı —
// tecrübesiz kullanıcı fiyatın düzenlenebilir olduğunu görür. Odaklanınca lira
// taslağına geçer, blur/Enter'da kuruşa çevrilip commit edilir (useRowEditor).
function PriceField({ row, ed, wide }: { row: Row; ed: RowEditor; wide?: boolean }) {
  if (!ed.editable) {
    return (
      <span data-slot="price-field" className={cn("text-sm tabular-nums", row.unitPrice == null && "text-muted-foreground/70")}>
        {row.unitPrice != null ? formatTRY(row.unitPrice) : "—"}
      </span>
    )
  }
  return (
    <InputGroup data-slot="price-field" className={cn("h-9", wide ? "w-32" : "w-28")}>
      <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
      <InputGroupInput
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="Fiyat"
        className="text-sm tabular-nums"
        value={ed.editingPrice ? ed.priceDraft : row.unitPrice != null ? String(kurusToLira(row.unitPrice)) : ""}
        onFocus={() => { if (!ed.editingPrice) ed.startPrice() }}
        onChange={(e) => { if (!ed.editingPrice) ed.startPrice(); ed.setPriceDraft(e.target.value) }}
        onBlur={ed.commitPrice}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
      />
    </InputGroup>
  )
}

function TotalField({ lineTotal, strong }: { lineTotal: number | null; strong?: boolean }) {
  return (
    <span className={cn(
      "tabular-nums",
      strong ? "text-[15px] font-bold tracking-tight" : "text-sm font-semibold",
      lineTotal == null ? "text-xs font-normal text-muted-foreground/70" : "text-foreground",
    )}>
      {lineTotal != null ? formatTRY(lineTotal) : "—"}
    </span>
  )
}

// Tür çipi: tarama kolaylığı için tipe göre renkli ikon+etiket rozeti (mobil kart
// başlığı). Parça=lacivert, İşçilik=amber, Dış İşçilik=mor.
function TypeChip({ type }: { type: ItemType }) {
  const cfg: Record<ItemType, { Icon: typeof Wrench; cls: string }> = {
    part: { Icon: PackagePlus, cls: "bg-primary/10 text-primary" },
    labor: { Icon: Wrench, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    external_labor: { Icon: ExternalLink, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  }
  const { Icon, cls } = cfg[type]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", cls)}>
      <Icon className="size-3.5" /> {TYPE_LABELS[type]}
    </span>
  )
}

// Kalemin kaynağını gösteren küçük rozet: katalog / manuel / dış alım. Tooltip
// masaüstünde hover, mobilde dokun(focus)-ile açılır. source=null → rozet yok.
function SourceBadge({ source }: { source: OrderItem["source"] }) {
  if (!source) return null
  const map = {
    catalog: { Icon: PackageCheck, label: "Katalogdan eklendi", cls: "text-primary" },
    manual: { Icon: PencilLine, label: "Manuel eklendi", cls: "text-muted-foreground" },
    purchase: { Icon: ShoppingCart, label: "Dışarıdan alındı", cls: "text-primary" },
  } as const
  const { Icon, label, cls } = map[source]
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md", cls)}
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Teknisyen kalemi yaptıysa görünen salt-okunur rozet (ofis işaretleyemez). */
function DoneBadge({ completedAt, className }: { completedAt?: string | null; className?: string }) {
  if (!completedAt) return null
  // Tür kolonu dar; damga ad kolonunun altında kendi satırında durur (çipler arasına
  // sıkışınca satır kayıyordu). Zaman damgası ofisin "ne zaman bitti" sorusunu karşılar.
  const stamp = new Date(completedAt).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-success", className)}>
      <Check className="size-3 shrink-0" />
      Yapıldı
      <span className="font-normal text-muted-foreground">· {stamp}</span>
    </span>
  )
}

// Dış alım (source=purchase) satırında görünen detay/düzenle tetikleyicisi. İkon →
// PurchaseDetailDialog açar (alış fiyatı/tedarikçi/tarih/foto görüntüle + düzenle).
function PurchaseDetailButton({ row, orderId, editable }: { row: Row; orderId: string; editable: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        className="shrink-0 text-muted-foreground hover:text-primary"
        aria-label="Satın alma detayı"
        title="Satın alma detayı"
      >
        <Tags className="size-4" />
      </Button>
      <PurchaseDetailDialog
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        editable={editable}
        item={{
          id: row.id,
          name: row.name,
          sku: row.sku,
          quantity: row.quantity,
          purchasePriceKurus: row.purchasePriceKurus ?? null,
          supplierName: row.supplierName ?? null,
          purchasedAt: row.purchasedAt ?? null,
          purchasedByName: row.purchasedByName ?? null,
          purchasePhotoId: row.purchasePhotoId ?? null,
        }}
      />
    </>
  )
}

// Başarılı otosave sonrası 2 sn'lik onay işareti. Masaüstünde dar kolonlara
// sığması için iconOnly, mobil kart başlığında metinli sürüm.
function SavedFlash({ show, iconOnly }: { show: boolean; iconOnly?: boolean }) {
  if (!show) return null
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success"
      title="Kaydedildi"
      aria-live="polite"
    >
      <CheckCircle2 className="size-3.5" />
      {!iconOnly && "Kaydedildi"}
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
// ile render olduğu için <td>/kart/composer içine yerleştirmek güvenli.
function RowTecdocPicker({ row, ed, vehicle, onCell, onShowDetail }: {
  row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell; onShowDetail: OnShowDetail
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
        onCell(row, { name: sel.name, sku: sel.articleNo, brand: sel.supplierName, category: sel.categoryName || null, categoryId: sel.categoryId || null, tecdocArticleId: sel.tecdocArticleId })
        ed.setFilter({
          supplierName: sel.supplierName || undefined,
          categoryId: sel.categoryId ?? undefined,
          categoryName: sel.categoryName || undefined,
        })
        ed.setTecdocOpen(false)
      }}
      onShowDetail={(a) =>
        onShowDetail({
          target: toDetailTarget(a, vehicle),
          onSelect: () => {
            onCell(row, {
              name: a.productName,
              sku: a.articleNo,
              brand: a.supplierName,
              tecdocArticleId: a.tecdocArticleId,
            })
            ed.setTecdocOpen(false)
          },
        })
      }
    />
  )
}

// Marka/Kategori için salt-görünür gösterim (kilitli emir + katalog kilidi ortak):
// düzenlenebilir alanların gri çip/hayalet kutusu YERİNE düz metin → kullanıcı
// tıklanacak bir kutu aramaz. oneLine: masaüstü satırında kısalt, mobilde sar.
function AttrReadOnly({ value, oneLine, title }: { value: string | null; oneLine?: boolean; title?: string }) {
  if (!value) return <span className="text-[11px] text-muted-foreground/40">—</span>
  return (
    <span
      className={cn(
        "block text-[11px] text-muted-foreground",
        oneLine ? "truncate" : "whitespace-normal break-words",
      )}
      title={title ?? value}
    >
      {value}
    </span>
  )
}

// Marka/Kategori hücresi (masaüstü + mobil + composer ortak). Düzenlenebilirken
// katalog önerili + serbest-metin Autocomplete; kilitliyken salt-görünür etiket.
function AttrCell({ kind, row, ed, vehicle, onCell, bare, oneLine }: {
  kind: "brand" | "category"; row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell; bare?: boolean
  /** Masaüstü satırı: kilitli emirde de tek satırda kalsın (uzun metin kısalır,
   *  tam hali title'da). Mobil kartta sarma korunur → tam metin görünür. */
  oneLine?: boolean
}) {
  if (!ed.isPart) return null
  const value = kind === "brand" ? row.brand : row.category

  // Salt-görünür (kilitli emir): mobilde sarar, masaüstü satırında kısalır.
  if (!ed.editable) return <AttrReadOnly value={value} oneLine={oneLine} />

  // Katalog parçasının MARKASI ve KATEGORİSİ de kimliğin parçası → düzenlenemez;
  // katalog verisi elle bozulunca satır artık gerçek parçayı temsil etmiyor.
  // Katalogdan BOŞ gelen alan (bazı kayıtlarda kategori/marka yok) düzenlenebilir
  // kalır: orada bozulacak katalog verisi yok, atölye eksiği tamamlayabilsin.
  if (ed.identityLocked && value) {
    return (
      <AttrReadOnly
        value={value}
        oneLine={oneLine}
        title={`${value} — katalogdan geldi, değiştirilemez`}
      />
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
      onOpenPicker={bare || !ed.linked ? undefined : () => ed.setTecdocOpen(true)}
      hideClear={bare}
    />
  )
}

// Satır tipine göre sol aksan şeridi rengi (ilk hücrede, mutlak-konumlu bar —
// border-collapse'tan bağımsız her zaman görünür).
const ROW_ACCENT: Record<ItemType, string> = {
  part: "bg-primary",
  labor: "bg-amber-500",
  external_labor: "bg-violet-500",
}

// ── Hayalet-satır: liste hücrelerindeki form kontrolleri düz metin gibi okunur;
// satır hover / focus-within olunca kenarlık belirir, aksiyonlar görünür.
// (Yalnız masaüstü <tr>'ye uygulanır; composer/mobil etkilenmez.)
const GHOST_ROW = cn(
  "group transition-colors hover:bg-muted/40",
  "[&_[data-slot=input-group]]:border-transparent [&_[data-slot=input-group]]:bg-transparent dark:[&_[data-slot=input-group]]:bg-transparent",
  "[&_[data-slot=input]]:border-transparent [&_[data-slot=input]]:bg-transparent dark:[&_[data-slot=input]]:bg-transparent",
  "[&_[data-slot=qty-stepper]]:border-transparent [&_[data-slot=qty-stepper]]:bg-transparent",
  "[&_[data-slot=price-field]]:border-transparent",
  "hover:[&_[data-slot=input-group]]:border-input hover:[&_[data-slot=input]]:border-input hover:[&_[data-slot=qty-stepper]]:border-input hover:[&_[data-slot=price-field]]:border-input",
  "focus-within:[&_[data-slot=input-group]]:border-input focus-within:[&_[data-slot=input]]:border-input focus-within:[&_[data-slot=qty-stepper]]:border-input focus-within:[&_[data-slot=price-field]]:border-input",
)

// Marka/Kategori alanlarının ortak kompakt ölçüsü/tipografisi: ad satırının
// altında ikincil meta olarak okunmalı → 11px, muted. !important → GHOST_ROW'un
// genel input-group kurallarını bu alanlarda ezer.
// NOT: alan-içi input `[&_input]` ile hedeflenir. `[data-slot=input-group-control]`
// seçicisiyle yazılan kurallar Tailwind çıktısında hiç üretilmiyordu (tipografi
// sessizce uygulanmıyordu) — bu yüzden bilerek input etiketi kullanılıyor.
const META_FIELD_BASE = cn(
  "[&_[data-slot=input-group]]:!rounded-md",
  "[&_input]:!text-[11px] [&_input]:!text-muted-foreground",
  "focus-within:[&_input]:!text-foreground",
)

// Masaüstü: hayalet meta — kutu yok, adın altında düz metin gibi hizalı okunur
// ("MARKA · Kategori"). Satır hover / odakta gri dolgu + kenarlık belirir →
// düzenlenebilir olduğu anlaşılır, ama boştayken satırı şişirmez.
const META_FIELD_DESKTOP = cn(
  META_FIELD_BASE,
  "[&_[data-slot=input-group]]:!h-7",
  "[&_[data-slot=input-group]]:!border-transparent [&_[data-slot=input-group]]:!bg-transparent",
  // Zemin ANINDA gelsin: input ve input-group'un kendi `transition-colors`ı
  // (150 ms) hover'da "geç beliriyor" hissi veriyordu. Dolgu zaten her durumda
  // px-2.5 (Input tabanı) → hover'da metin kaymaz, yalnız zemin belirir.
  "[&_[data-slot=input-group]]:!transition-none [&_input]:!transition-none",
  "group-hover:[&_[data-slot=input-group]]:!bg-muted/60",
  "focus-within:[&_[data-slot=input-group]]:!border-input focus-within:[&_[data-slot=input-group]]:!bg-background",
)

// Mobil: hover yok → alanların düzenlenebilir olduğu ancak dolgu ile belli olur;
// bu yüzden kart içinde hafif gri çip görünümü korunur.
const META_FIELD_MOBILE = cn(
  META_FIELD_BASE,
  "[&_[data-slot=input-group]]:!h-8",
  "[&_[data-slot=input-group]]:!border-transparent [&_[data-slot=input-group]]:!bg-muted/60",
  "focus-within:[&_[data-slot=input-group]]:!border-input focus-within:[&_[data-slot=input-group]]:!bg-background",
)

// ── Masaüstü satırı: gerçek <tr> (çarşaf liste) ──────────────────────────────
function DesktopPartRow({ row, orderId, locked, vehicle, onCell, onRemove, saved, onShowDetail }: {
  row: Row
  orderId: string
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
  saved?: boolean
  onShowDetail: OnShowDetail
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)
  const type = row.type as ItemType
  const showMeta = ed.isPart && (ed.editable || !!row.brand || !!row.category)

  return (
    <TableRow className={cn(GHOST_ROW, "align-middle")}>
      {/* Tür: sol renk aksanı (mutlak bar) + tür çipi + kaynak rozeti + (dış alımda) detay ikonu */}
      <TableCell className="relative py-3.5 pl-[18px]">
        <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", ROW_ACCENT[type] ?? "bg-transparent")} />
        <div className="flex items-center gap-1.5">
          <TypeChip type={type} />
          <SourceBadge source={row.source} />
          {row.source === "purchase" && (
            <PurchaseDetailButton row={row} orderId={orderId} editable={ed.editable} />
          )}
        </div>
      </TableCell>

      {/* Parça / İşçilik: ad (hayalet) + parça için Marka/Kategori meta satırı */}
      <TableCell className="whitespace-normal py-3.5">
        <div className="min-w-0">
          <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onShowDetail={onShowDetail} />
          <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} onShowDetail={onShowDetail} />
          {showMeta && (
            // Marka + Kategori HER ZAMAN tek satır: sabit genişlik yerine esneyen
            // iki eşit sütun (kolon daraldığında alt alta sarıp satırı uzatmasın).
            <div className={cn("mt-0.5 flex items-center gap-1", META_FIELD_DESKTOP)}>
              <div className="min-w-0 flex-1"><AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare oneLine /></div>
              <span aria-hidden className="shrink-0 text-[11px] text-muted-foreground/40">·</span>
              <div className="min-w-0 flex-1"><AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare oneLine /></div>
            </div>
          )}
          <DoneBadge completedAt={row.completedAt} className="mt-1.5" />
        </div>
      </TableCell>

      {/* Miktar */}
      <TableCell className="py-3.5">
        <div className="flex justify-center">
          <QtyStepper row={row} editable={ed.editable} onCell={onCell} />
        </div>
      </TableCell>

      {/* Birim Fiyat */}
      <TableCell className="py-3.5">
        <div className="flex justify-end">
          <PriceField row={row} ed={ed} wide />
        </div>
      </TableCell>

      {/* Toplam (vurgulu) + otosave onayı */}
      <TableCell className="py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          <SavedFlash show={!!saved} iconOnly />
          <TotalField lineTotal={ed.lineTotal} strong />
        </div>
      </TableCell>

      {/* Sil (yalnız hover'da belirir) */}
      <TableCell className="py-3.5">
        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {ed.editable && <DeleteButton row={row} onRemove={onRemove} />}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Mobil satırı: kart (çarşaf liste) ────────────────────────────────────────
function MobilePartRow({ row, orderId, locked, vehicle, onCell, onRemove, saved, onShowDetail }: {
  row: Row
  orderId: string
  locked: boolean
  vehicle?: PickerVehicle
  onCell: OnCell
  onRemove: (row: Row) => void
  saved?: boolean
  onShowDetail: OnShowDetail
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)
  const type = row.type as ItemType
  const showMeta = ed.isPart && (ed.editable || !!row.brand || !!row.category)

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 pl-4 shadow-sm">
      {/* Sol tür aksanı */}
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", ROW_ACCENT[type] ?? "bg-transparent")} />

      {/* Başlık: tür çipi + kaynak rozeti + (dış alımda) detay ikonu · sil */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <TypeChip type={type} />
          <SourceBadge source={row.source} />
          {row.source === "purchase" && (
            <PurchaseDetailButton row={row} orderId={orderId} editable={ed.editable} />
          )}
          <SavedFlash show={!!saved} />
        </div>
        {ed.editable && <DeleteButton row={row} onRemove={onRemove} />}
      </div>

      {/* Parça / İşçilik adı (öne çıkan) — hayalet: kenarlıksız, odakta belirir */}
      <div className={cn(
        "mt-2",
        "[&_[data-slot=input-group]]:border-transparent [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input]]:border-transparent [&_[data-slot=input]]:bg-transparent",
        "[&_[data-slot=input-group]]:px-0 [&_[data-slot=input]]:!px-0 [&_[data-slot=input]]:font-medium",
        "focus-within:[&_[data-slot=input-group]]:border-input focus-within:[&_[data-slot=input]]:border-input focus-within:[&_[data-slot=input]]:!px-2.5",
      )}>
        <PartField row={row} ed={ed} vehicle={vehicle} onCell={onCell} onShowDetail={onShowDetail} />
        <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} onShowDetail={onShowDetail} />
        <DoneBadge completedAt={row.completedAt} className="mt-1.5" />
      </div>

      {/* Marka / Kategori — kompakt gri çipler (etiketsiz), yalnız parça */}
      {showMeta && (
        <div className={cn("mt-1.5 flex flex-wrap gap-1.5", META_FIELD_MOBILE)}>
          <div className="min-w-[7rem] flex-1"><AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare /></div>
          <div className="min-w-[7rem] flex-1"><AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare /></div>
        </div>
      )}

      {/* Fiş satırı: Miktar · Birim Fiyat = Toplam (tek satırda, yığılmadan) */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <QtyStepper row={row} editable={ed.editable} onCell={onCell} />
        <div className="ml-auto flex items-center gap-2">
          <PriceField row={row} ed={ed} />
          <span className="text-sm text-muted-foreground">=</span>
          <TotalField lineTotal={ed.lineTotal} strong />
        </div>
      </div>
    </div>
  )
}
