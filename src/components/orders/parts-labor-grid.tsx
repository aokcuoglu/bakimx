"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { StockPartLite } from "@/lib/parts/suggestions"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Minus, Trash2, Loader2, PackagePlus, PencilLine, Tags, PackageCheck, Wrench, ShoppingCart, ExternalLink, CheckCircle2, PackageSearch, Info, Check, Store, AlertTriangle, MoreHorizontal, ReceiptText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { splitRowActions } from "@/lib/orders/row-actions"
import { PurchaseDetailDialog } from "@/components/purchases/purchase-detail-dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
import { formatTRY } from "@/lib/format"
import { formatItemAddedMessage } from "@/lib/orders/item-added-message"
import { kurusToLira, parseTRYToKurus } from "@/lib/money"
import { evaluateMoneyExpression } from "@/lib/money-expression"
import { isDivisibleOrderItemUnit, ORDER_ITEM_UNIT_LABELS, ORDER_ITEM_UNITS } from "@/lib/orders/quantity"
import { effectiveTaxBps, lineVatKurus } from "@/lib/orders/line-vat"
import {
  needsMarkup,
  purchaseMarginHint,
  purchaseMarginNoticeMessage,
  purchaseMarginPercent,
  purchaseMarginState,
  showsPurchaseCost,
  type PurchaseMarginState,
} from "@/lib/orders/purchase-margin"
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
import { OrderItemUnitCombobox } from "@/components/orders/order-item-unit-combobox"
import { PartDetailDialog, type PartDetailTarget } from "@/components/parts/part-detail-dialog"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import { bakimxLineItemFields } from "@/lib/parts/bakimx-item"
import { createQuickPartAction, ensureVehiclePartsPrefetched } from "@/app/(app)/parts/actions"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

// brandSupplierId: yalnız runtime — marka→kategori best-effort filtresi için
// seçili markanın TecDoc supplierId'sini taşır; ASLA persist edilmez.
// __partId: atölyenin kendi stok kartına bağ. Set edilirse sunucu stok düşümü
// yapar ve stok yetmezse eklemeyi TÜMÜYLE reddeder — bilinçli. BakımX kaleminde
// bu alan DAİMA boştur (bkz. lib/parts/bakimx-item.ts).
type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string; brandSupplierId?: number | null; __partId?: string | null }

// Satır-yerel arama filtresi (persist EDİLMEZ). Combobox seçimi buraya yazar;
// parça seçilince senkronlanır; satır temizlenince sıfırlanır.
type PartFilter = { supplierId?: number; supplierName?: string; categoryId?: number; categoryName?: string }

type OnCell = (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean; localOnly?: boolean }) => void

// Satırda 2 sn görünen geçici onay işareti: yeni kalem eklendi mi, mevcut satır
// otosave ile kaydedildi mi — ikisi ayrı okunur (bkz. RowFlash).
type FlashKind = "saved" | "added"
const FLASH_LABELS: Record<FlashKind, string> = { saved: "Kaydedildi", added: "Eklendi" }

/**
 * Parça detay modalı açma isteği. Modal TEK örnek olarak PartsLaborGrid'de durur
 * (Autocomplete popup'ının içinde Dialog render etmek odak/portal çakışması
 * yaratıyor); açan taraf hedefi ve — seçim bağlamındaysa — seçme eylemini verir.
 */
type DetailRequest = { target: PartDetailTarget; onSelect?: () => void }
type OnShowDetail = (req: DetailRequest) => void

/**
 * KDV bağlamı (BAK-75). Girilen ve gösterilen tutar HER ZAMAN NET'tir; bu bağlam
 * yalnız satırın "+₺X KDV" ipucunda kullanılacak oranı ve tick açıldığında
 * belgeye standart oranı yazacak geri çağırımı taşır. Composer, masaüstü satırı
 * ve mobil kart aynı değeri buradan okur — on hücreden prop geçirmek yerine.
 */
type VatState = {
  /** Satır KDV ipucunda kullanılan oran (bps) — belgenin oranı, yoksa standart %20. */
  taxBps: number
  /** Satır başına KDV tick'i bu belgede anlamlı mı (teklifte değil — bkz. QuoteItemsEditor). */
  perLine: boolean
  /**
   * Yeni satırın KDV varsayılanı. İş emrinde `false` (BAK-75); teklifte belgenin
   * KDV oranı zaten tüm kalemlere işlediği için `true`.
   */
  defaultLiable: boolean
  /**
   * Belgede KDV oranı yokken bir satırın tick'i açılınca çağrılır: standart %20
   * belgeye yazılır. Olmazsa satırda "+₺20,00 KDV" yazarken Genel Toplam'a hiç
   * KDV girmez — ekranla hesap ayrışır.
   */
  ensureDocumentTax: () => void
}

const VatContext = createContext<VatState>({
  taxBps: effectiveTaxBps(null),
  perLine: true,
  defaultLiable: false,
  ensureDocumentTax: () => {},
})

function useVat(): VatState {
  return useContext(VatContext)
}

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

/** Composer'ın yazabildiği kaynaklar (dış alım kendi akışından gelir). */
type DraftSource = "catalog" | "manual" | "bakimx"

// Composer'ın boş taslağı (tek satırlık ekleme formu için — listede birikmez).
// source: kalemin kaynağı (katalog composer → "catalog", manuel → "manual",
// BakımX kataloğu → "bakimx").
// includeVat AÇIKÇA yazılır (BAK-75): iyimser satır sunucu yanıtı gelmeden de
// listede doğru okunsun, "az önce KDV'siz eklenen kalem bir an KDV'li göründü"
// titremesi olmasın.
function emptyDraft(type: ItemType, source: DraftSource, includeVat: boolean): Row {
  return {
    id: "composer", type, name: "", sku: null, unit: "adet",
    quantity: 1, unitPrice: null, totalPrice: null, note: null, brand: null, category: null, categoryId: null,
    includeVat,
    source,
  }
}

/** Kalem satırı — kalıcılık katmanından bağımsız (bkz. PartsLaborEditor). */
export type PartsLaborRow = Row

/**
 * Kalem düzenleyicinin SUNUM çekirdeği: composer'lar (katalog araması, TecDoc
 * picker'ı, manuel parça diyalogu, işçilik autocomplete'i), masaüstü tablosu,
 * mobil kart listesi ve parça detay modalı.
 *
 * Kalıcılık BİLMEZ. Satırları prop olarak alır, değişiklikleri `onAdd`/`onCell`/
 * `onRemove` ile çağırana bildirir. İki adaptörü vardır:
 * - `PartsLaborGrid` (iş emri): her çağrıyı `/api/orders/items` uçlarına yazar,
 *   yani kalem anında kalıcılaşır ve `partId` set edilirse stok düşülür.
 * - `QuoteItemsEditor` (teklif): değişiklikleri react-hook-form `useFieldArray`
 *   durumunda tutar; kayıt yalnız teklif gönderilirken olur ve stok HİÇ hareket
 *   etmez (bkz. src/lib/quotes/quote-stock-invariant.test.ts).
 */
export function PartsLaborEditor({
  rows, vehicle, locked, loading, laborCatalog, orderId,
  allowExternalLabor = true, showAttributes = true,
  taxRateBps, onApplyStandardTax, vatPerLine = true, defaultVatLiable = false,
  flash, onAdd, onCell, onRemove,
}: {
  rows: Row[]
  vehicle?: PickerVehicle
  locked: boolean
  loading: boolean
  laborCatalog: LaborCatalogRow[]
  /** Yalnız iş emri tarafında dolu — dış alım (source=purchase) detay modalı için. */
  orderId?: string
  /** Dış işçilik yalnız iş emri kavramı; teklif kalemi tipi part|labor ile sınırlı. */
  allowExternalLabor?: boolean
  /** Marka/Kategori meta alanları — yalnız bunları saklayabilen tarafta gösterilir. */
  showAttributes?: boolean
  /** Belgenin (iş emri / teklif) KDV oranı — bps. Tanımsız/0 ise standart %20 varsayılır. */
  taxRateBps?: number | null
  /** Belgede KDV oranı yokken bir satırın KDV tick'i açılınca %20'yi belgeye yazar. */
  onApplyStandardTax?: () => void
  /**
   * Satır başına KDV tick'i gösterilsin mi. Teklifte `false`: QuoteItem'da
   * `includeVat` kolonu YOK, tick kaydedilemez — teklif KDV'si belgenin kendi
   * "KDV Oranı (%)" alanından gelir. Kaydedilemeyen bir kontrol göstermek
   * kullanıcıya yalan söylerdi.
   */
  vatPerLine?: boolean
  /** Yeni satırın KDV varsayılanı — iş emrinde kapalı (BAK-75), teklifte açık. */
  defaultVatLiable?: boolean
  flash: { rowId: string; kind: FlashKind } | null
  onAdd: (draft: Row) => Promise<boolean>
  onCell: OnCell
  onRemove: (row: Row) => void
}) {
  // Parça detay modalı (tek örnek) — arama, katalog picker'ı ve kalem satırları besler.
  const [detail, setDetail] = useState<DetailRequest | null>(null)

  const documentTaxSet = (taxRateBps ?? 0) > 0
  const vat = useMemo<VatState>(
    () => ({
      taxBps: effectiveTaxBps(taxRateBps),
      perLine: vatPerLine,
      defaultLiable: defaultVatLiable,
      ensureDocumentTax: () => {
        if (!documentTaxSet) onApplyStandardTax?.()
      },
    }),
    [taxRateBps, vatPerLine, defaultVatLiable, documentTaxSet, onApplyStandardTax]
  )

  const headCls = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

  return (
    <VatContext.Provider value={vat}>
    <PartAttrOptionsProvider vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}>
    <TooltipProvider>
    {/* min-w-0: düzenleyici bir grid/flex hücresinin içine konduğunda (teklif
        ekranında FormItem `display:grid`) hücrenin otomatik asgari genişliği
        min-content olur; içerideki 52rem'lik tablo yüzünden hücre 834px'e
        büyüyüp Card'ın `overflow-hidden`'ı tarafından KESİLİYORDU (#290).
        @container: masaüstü tablo / mobil kart seçimi artık ekran genişliğine
        değil DÜZENLEYİCİNİN KENDİ genişliğine bakıyor — dar bir kolonda
        (teklif formu ~730px) yatay kaydırmalı tablo yerine kart düzeni çıkar. */}
    <div className="@container min-w-0 space-y-4">
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
              <UnifiedPartComposer vehicle={vehicle} onAdd={onAdd} disabled={loading} onShowDetail={setDetail} />
            </ComposerCard>
          </TabsContent>
          <TabsContent value="iscilik" className="pt-4">
            <ComposerCard>
              <LaborComposer
                onAdd={onAdd}
                disabled={loading}
                catalog={laborCatalog}
                allowExternal={allowExternalLabor}
              />
            </ComposerCard>
          </TabsContent>
        </Tabs>
      )}

      {!locked && <Separator />}

      {/* BAK-91 — maliyetine duran kalemler için liste üstü hatırlatma. Kilitli
          belgede gizli: fiyat artık değiştirilemez, uyarı yalnız gürültü olur. */}
      {!locked && <PurchaseMarginNotice rows={rows} />}

      {/* Ortak çarşaf liste: her iki tab'dan eklenen kalemler. Düzenle + sil. */}
      {/* Geniş kapsayıcı (≥52rem): gerçek shadcn Base <table>. Eşik tablonun kendi
          min genişliği; altında tablo zaten yatay kaydırmaya düşerdi, onun yerine
          aşağıdaki kart düzeni devreye girer.
          BAK-75 §4 — satır alanı KENDİ İÇİNDE kaydırılır (`ITEM_LIST_SCROLL`):
          10 kalem eklendiğinde sayfa aşağı kaymadığı için üstteki finansal şerit
          (Ara Toplam / İndirim / KDV / Genel Toplam) ekranda kalır. Başlık satırı
          `sticky` — kaydırırken hangi kolonun ne olduğu kaybolmaz. */}
      <div className="hidden overflow-hidden rounded-lg border border-border @min-[52rem]:block">
        <Table className="min-w-[52rem] table-fixed" containerClassName={ITEM_LIST_SCROLL}>
          <colgroup>
            <col className="w-40" />{/* Tür */}
            <col />{/* Parça / İşçilik + Marka/Kategori meta (kalan alan) */}
            <col className="w-28" />{/* Miktar */}
            <col className="w-24" />{/* Birim */}
            {vatPerLine && <col className="w-16" />}{/* KDV */}
            <col className="w-36" />{/* Birim Fiyat */}
            <col className="w-28" />{/* Toplam */}
            {/* İşlem — en çok iki 36px ikon + boşluk (BAK-104, bkz. RowActions) */}
            <col className="w-24" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(headCls, "pl-[18px]")}>Tür</TableHead>
              <TableHead className={headCls}>Parça / İşçilik</TableHead>
              <TableHead className={cn(headCls, "text-center")}>Miktar</TableHead>
              <TableHead className={cn(headCls, "text-center")}>Birim</TableHead>
              {/* BAK-53 — satır KDV'ye tabi mi. Tick açıkken satırın altında
                  eklenecek KDV tutarı yazar; Genel Toplam'a da o KDV girer. */}
              {vatPerLine && <TableHead className={cn(headCls, "text-center")}>KDV</TableHead>}
              <TableHead className={cn(headCls, "text-right")}>Birim Fiyat</TableHead>
              <TableHead className={cn(headCls, "text-right")}>Toplam</TableHead>
              <TableHead className={cn(headCls, "text-right")}><span className="sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={vatPerLine ? 8 : 7}>
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
                  showAttributes={showAttributes}
                  onCell={onCell}
                  onRemove={onRemove}
                  flash={flash?.rowId === row.id ? flash.kind : null}
                  onShowDetail={setDetail}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dar kapsayıcı (<52rem): kart düzeni — mobil ekran VE masaüstündeki dar
          kolon (teklif formu) aynı düzeni paylaşır. Kaydırma kuralı masaüstüyle
          aynı (BAK-75 §4). */}
      <div className={cn("space-y-2 @min-[52rem]:hidden", rows.length > 0 && ITEM_LIST_SCROLL)}>
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
              showAttributes={showAttributes}
              onCell={onCell}
              onRemove={onRemove}
              flash={flash?.rowId === row.id ? flash.kind : null}
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
    </VatContext.Provider>
  )
}

/**
 * Kalem listesinin kendi kaydırma alanı (BAK-75 §4).
 *
 * Yükseklik `vh` ile değil sabit `rem` ile sınırlanır: iOS'ta adres çubuğu
 * gizlenip görünürken `vh` değişip liste zıplıyor. ~26rem beş satır gösterir,
 * altıncısının ucu görünür — liste devam ediyor sinyali. `overscroll-contain`:
 * liste sonuna gelince kaydırma sayfaya SIÇRAMAZ.
 *
 * Masaüstünde bu sınıflar tablonun KENDİ kabına (`containerClassName`) verilir,
 * dıştaki kutuya değil: `sticky` başlık en yakın kaydıran atasına göre yapışır
 * ve o ata, shadcn `Table`'ın `overflow-x-auto`'lu kabıdır.
 */
const ITEM_LIST_SCROLL = "max-h-[26rem] overflow-y-auto overscroll-contain"

/**
 * Liste üstü marj hatırlatması (BAK-91).
 *
 * Satır-içi renk tek kalemi işaretler; bu şerit iş emrini KAPATAN kişiye toplu
 * cevap verir ("2 kalem hâlâ alış fiyatında"). Liste kendi içinde kaydığı için
 * (ITEM_LIST_SCROLL) uyarılı satır ekranın dışında kalabilir — şerit listenin
 * ÜSTÜNDE, kaydırma alanının dışında durur.
 *
 * Engelleyici DEĞİLDİR: sıfır marjla satmak geçerli bir karar olabilir (garanti,
 * jest). Eksik olan kural değil görünürlüktü.
 */
function PurchaseMarginNotice({ rows }: { rows: Row[] }) {
  const message = purchaseMarginNoticeMessage(rows)
  if (!message) return null
  return (
    <Alert variant="warning" className="border-warning/20 bg-warning/10">
      <AlertTriangle />
      <AlertTitle className="text-xs font-medium text-pretty">{message}</AlertTitle>
    </Alert>
  )
}

/**
 * İŞ EMRİ adaptörü: PartsLaborEditor'ün her değişikliğini `/api/orders/items`
 * uçlarına yazar — kalem ANINDA kalıcılaşır ve `__partId` doluysa sunucu stoktan
 * düşer/rezerve eder. Teklif tarafı bu adaptörü KULLANMAZ (bkz. QuoteItemsEditor).
 */
export function PartsLaborGrid({
  orderId, status, items, vehicle, onError, loading, laborCatalog, taxRateBps, onApplyStandardTax,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: PickerVehicle
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
  laborCatalog: LaborCatalogRow[]
  /** İş emrinin KDV oranı (bps) — KDV dahil/hariç gösterimi için. */
  taxRateBps?: number | null
  /** İş emrinde KDV oranı yokken standart %20'yi uygulayan geri çağırım. */
  onApplyStandardTax?: () => void
}) {
  const router = useRouter()
  const locked = isOrderLocked(status as OrderStatus)
  const [rows, setRows] = useState<Row[]>(items.map(toRow))
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Sessiz otosave'i / yeni eklemeyi görünür kılan geçici satır işareti:
  // başarılı PATCH sonrası "✓ Kaydedildi", yeni kalem eklendikten sonra
  // "✓ Eklendi" olarak 2 sn gösterilir (tecrübesiz kullanıcı için
  // "değişikliğim kaydoldu mu / parça eklendi mi?" belirsizliğini kaldırır).
  const [flash, setFlash] = useState<{ rowId: string; kind: FlashKind } | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function flashRow(rowId: string, kind: FlashKind) {
    setFlash({ rowId, kind })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2000)
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
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  function patchLocal(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  // Composer'dan gelen taslağı TEK POST ile ekle. Başarıda optimistik olarak
  // listeye ekler + router.refresh() ile sunucudan doğrular. true dönerse
  // composer kendini sıfırlar.
  async function addItem(draft: Row): Promise<boolean> {
    const name = draft.name.trim()
    if (!name) return false
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", draft.type)
    fd.set("name", name)
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
    // BakımX katalog bağı. Sunucu ürünü bu id ile DB'den okur ve kalemin
    // ad/parça no/marka/kategori/alış fiyatı alanlarını oradan yazar — buradan
    // gönderilen değerler yalnız iyimser satır içindir (bkz. addOrderItemAction).
    if (draft.bakimxProductId) fd.set("bakimxProductId", draft.bakimxProductId)
    // BAK-53 — satır KDV bayrağı. Sunucu varsayılanı da `true`, ama taslakta
    // kullanıcı işareti kaldırdıysa o karar kaybolmamalı.
    if (draft.includeVat !== undefined) fd.set("includeVat", String(draft.includeVat !== false))
    // Stok kartına bağlıysa sunucu stoğu düşürür (bkz. Row.__partId).
    if (draft.__partId) fd.set("partId", draft.__partId)
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.id) {
        const realId: string = data.id
        setRows((prev) => [
          ...prev,
          { ...toRow(draft), id: realId, __draft: false, brandSupplierId: draft.brandSupplierId },
        ])
        // Arama kutusu ekleme sonrası temizlendiği için ekranda "bir şey oldu mu?"
        // sorusu kalıyordu (issue #209): eklenen kalemin adını toast ile bildir ve
        // listeye düşen satırı kısa süre "✓ Eklendi" ile işaretle.
        toast.success(formatItemAddedMessage(draft.type, name))
        flashRow(realId, "added")
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
      if (patch.includeVat !== undefined) fd.set("includeVat", String(patch.includeVat !== false))
      try {
        const res = await fetch(`/api/orders/items?id=${rowId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) { onError(data.error || "Kalem güncellenemedi"); setRows(items.map(toRow)) }
        else { flashRow(rowId, "saved"); router.refresh() }
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

  return (
    <PartsLaborEditor
      rows={rows}
      vehicle={vehicle}
      locked={locked}
      loading={loading}
      laborCatalog={laborCatalog}
      orderId={orderId}
      taxRateBps={taxRateBps}
      onApplyStandardTax={onApplyStandardTax}
      flash={flash}
      onAdd={addItem}
      onCell={onCell}
      onRemove={removeRow}
    />
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
          Eşleşen işçilik yok — kendi kaleminizi yazabilirsiniz
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
function LaborComposer({ onAdd, disabled, catalog, allowExternal = true }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; catalog: LaborCatalogRow[]
  /** Teklifte kapalı: QuoteItem tipi yalnız part|labor kabul eder. */
  allowExternal?: boolean
}) {
  const [nonce, setNonce] = useState(0)
  const [mode, setMode] = useState<"labor" | "external_labor">("labor")
  const effectiveMode = allowExternal ? mode : "labor"
  return (
    <div className="space-y-3">
      {allowExternal && <LaborModeToggle mode={mode} onChange={setMode} disabled={disabled} />}
      <LaborComposerBody
        key={`${effectiveMode}-${nonce}`}
        mode={effectiveMode}
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
  const vat = useVat()
  const [draft, setDraft] = useState<Row>(() => emptyDraft(mode, "manual", vat.defaultLiable))
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
        {/* Taslakta da KDV tick'i var (BAK-75): işçilik fiyatı zaten burada
            yazılıyor, KDV kararını eklemeden sonra ikinci bir tıkla vermek
            gereksiz. Tutar NET yazılır, tick yalnız üstüne ne bineceğini söyler. */}
        {vat.perLine && (
          <Field label="KDV">
            <div className="flex h-9 items-center">
              <VatCell row={draft} ed={ed} onCell={onCell} />
            </div>
          </Field>
        )}
        <Field label="Birim Fiyat">
          <PriceField row={draft} ed={ed} wide />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
        <TotalPreview lineTotal={ed.grossLineTotal} vatKurus={ed.vatKurus} />
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
  // Yeni satırın KDV varsayılanı (BAK-75) — taslak listeye düşmeden önce
  // yazılır ki iyimser satır bir an KDV'li görünmesin.
  const vat = useVat()
  const submittingRef = useRef(false)
  // Bu modal oturumunda açılan stok kartının kodu (yeniden denemede ikinci kart
  // açılmasını engeller). Modal her açılışta sıfırlanır.
  const createdPartSkuRef = useRef<string | null>(null)
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

  // #157 — araca bağlı olmayan (kendi stoğumuzdan) bir parça eklenmeden önce
  // kullanıcıya sorulur. Onaysız ekleme yok: katalog dışı parça yanlış araca
  // takılırsa sahada maliyeti yüksek.
  const [stockConfirm, setStockConfirm] = useState<StockPartLite | null>(null)

  /** Stok kartı → kalem taslağı. partId bağı stok düşümünü tetikler. */
  function stockDraft(p: StockPartLite): Partial<Row> & { source: "manual" } {
    return {
      source: "manual",
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      unit: p.unit,
      unitPrice: p.salePrice,
      __partId: p.id,
    }
  }

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

  /**
   * BakımX ürünü → kalem taslağı (BAK-35). Alanların TAMAMI `bakimxLineItemFields`
   * ten gelir: `partId` yok (BakımX stoğu atölyenin stoğu değil, düşüm
   * tetiklenmez), `categoryId` null (o kolon TecDoc düğüm id'si), fiyat
   * `purchasePriceKurus`'a yazılıp `unitPrice`'a ön-doldurulur. Gerekçeler tek
   * yerde: src/lib/parts/bakimx-item.ts.
   */
  function bakimxDraft(p: BakimxProductSummary): Partial<Row> & { source: "bakimx" } {
    const fields = bakimxLineItemFields(p)
    return {
      source: fields.source,
      name: fields.name,
      sku: fields.sku,
      brand: fields.brand,
      category: fields.category,
      categoryId: fields.categoryId,
      unit: fields.unit,
      bakimxProductId: fields.bakimxProductId,
      purchasePriceKurus: fields.purchasePriceKurus,
      unitPrice: fields.unitPrice,
    }
  }

  // Tek ekleme yolu: emptyDraft üzerine partial'ı bindir → addItem. Başarıda kutuyu sıfırla.
  async function add(partial: Partial<Row> & { source: DraftSource }): Promise<boolean> {
    if (submittingRef.current || !partial.name?.trim()) return false
    submittingRef.current = true
    setSubmitting(true)
    const ok = await onAdd({ ...emptyDraft("part", partial.source, vat.defaultLiable), ...partial, name: partial.name.trim() })
    submittingRef.current = false
    setSubmitting(false)
    if (ok) { setName(""); setFilter({}) }
    return ok
  }

  /**
   * "Oluştur & Düzenle" modalının gönderimi. Anahtar açıksa ÖNCE kalıcı stok
   * kartı açılır, sonra kalem eklenir: kod çakışması gibi hatalar hiçbir şey
   * eklenmeden yakalansın ve kullanıcı modalda kodu düzeltebilsin. Kart açıldıktan
   * sonra kalem ekleme başarısız olursa (ör. iş emri bu arada kilitlenmişse) kart
   * kalır — hata üstteki uyarı alanında görünür, tekrar denemede aynı kodla ikinci
   * kart açılamaz.
   *
   * Hata mesajı döndürmek modalı AÇIK bırakır; null dönüşü başarıyı bildirir.
   */
  async function submitManualDraft(d: ManualPartDraft): Promise<string | null> {
    const sku = d.sku?.trim() || null
    // Kart açıldıktan sonra kalem ekleme takılırsa kullanıcı aynı modalda tekrar
    // dener; ikinci denemede aynı kodla kart AÇILMAZ (yoksa kendi açtığı kart
    // "bu kod zaten kullanılıyor" diyip kullanıcıyı çıkmaza sokardı). Kod
    // değiştirilirse ref eşleşmez ve yeni kart açılır.
    if (d.createStockItem && sku !== createdPartSkuRef.current) {
      if (submittingRef.current) return null
      submittingRef.current = true
      setSubmitting(true)
      try {
        const fd = new FormData()
        fd.set("sku", sku ?? "")
        fd.set("name", d.name)
        if (d.brand) fd.set("brand", d.brand)
        if (d.category) fd.set("category", d.category)
        if (d.unitPrice != null) fd.set("salePrice", String(d.unitPrice))
        const res = await createQuickPartAction(fd)
        // NOT: sadece `"error" in res` yazılır — `&& res.error` eklemek birleşim
        // tipini erken dönüşten sonra daraltmaz ve başarı dalındaki alanlar derlenmez.
        if ("error" in res) return res.error
        createdPartSkuRef.current = res.sku
        toast.success(`Stok kartı oluşturuldu · ${res.sku}`)
      } finally {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
    // Kalem karta BAĞLANMAZ (partId yok): stok düşümü tetiklenmesin diye —
    // gerekçe createQuickPartAction başlığında.
    const ok = await add({
      source: "manual",
      name: d.name,
      sku,
      brand: d.brand,
      category: d.category,
      categoryId: d.categoryId,
      quantity: d.quantity,
      unit: d.unit,
      unitPrice: d.unitPrice,
    })
    if (ok) setDialogOpen(false)
    // Ekleme hatası TOAST ile bildirilir, modal içine yazılmaz: modaldeki satır-içi
    // hata alanı stok kodu alanına bağlıdır (aria-invalid) ve buradaki hatanın kodla
    // ilgisi yok. Ayrıntılı sunucu mesajı arkadaki uyarı alanında (onError) durur.
    if (!ok) toast.error("Kalem eklenemedi. Lütfen tekrar deneyin.")
    return null
  }

  return (
    <div className="space-y-3">
      {!linked && (
        // Bağlama yolu burada da dursun: aksi hâlde katalogsuz araçta kullanıcı
        // "sınırlı" uyarısıyla baş başa kalıyor (VinLinkPrompt yalnız
        // TecdocPartPicker içinde ve o da `linked` iken basılıyordu).
        <div className="space-y-2 rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Araç katalogla eşleşmediği için araca özel parça araması sınırlı — BakımX ürünleri ve
            kendi stok kartlarınız yine aranabilir, ya da parçayı{" "}
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
        placeholder="Parça no, adı, marka veya OEM ara…"
        onNameChange={setName}
        onSelectArticle={(a) => void add(catalogDraft(a))}
        onSelectStockPart={(p) => setStockConfirm(p)}
        onSelectBakimxProduct={(p) => void add(bakimxDraft(p))}
        onShowDetail={(a) =>
          onShowDetail({ target: toDetailTarget(a, vehicle), onSelect: () => void add(catalogDraft(a)) })
        }
        onCommit={() => { if (name.trim()) void add({ source: "manual", name }) }}
        onClear={() => { setName(""); setFilter({}) }}
        showClear={!!name}
        // BAK-35 — seçici araç kataloğa bağlı olmasa da açılabilir: BakımX dalı
        // araçtan bağımsız çalışır, modal içinde VIN bağlama yolu da duruyor.
        onSearchClick={vehicle ? () => setTecdocOpen(true) : undefined}
        searchDisabled={!vehicle}
        searchTitle={linked ? "Katalogdan seç" : "BakımX ürünlerinden seç"}
        showCreate
        onCreate={(text) => void add({ source: "manual", name: text })}
        onCreateEdit={(text) => { setName(text); createdPartSkuRef.current = null; setDialogOpen(true) }}
        refreshSignal={refreshSignal}
        onResultsCount={handleResultsCount}
      />

      {/* #157 — araca bağlı olmayan parçada onay. Stok adedi burada gösterilir:
          sunucu stok yetmezse eklemeyi tümüyle reddediyor, kullanıcı bunu
          reddedilmeden ÖNCE görsün. */}
      <AlertDialog open={stockConfirm != null} onOpenChange={(o) => { if (!o) setStockConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu parça bu araca bağlı değil</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{stockConfirm?.name}</span> kendi stok
              kartlarınızdan geliyor; aracın katalog listesinde yer almıyor. Uygun olduğundan emin
              misiniz?
              {stockConfirm != null && (
                <span className="mt-2 block">
                  Mevcut stok: {stockConfirm.stockQty} {stockConfirm.unit}
                  {stockConfirm.stockQty <= 0 && " — stok yok, ekleme reddedilebilir."}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = stockConfirm
                setStockConfirm(null)
                if (p) void add(stockDraft(p))
              }}
            >
              Yine de ekle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {prefetching && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Araca uygun parçalar hazırlanıyor…
        </p>
      )}

      {/* Katalog picker (🔍). TecDoc dalı yalnız araç kataloğa bağlıysa dolar;
          BakımX dalı her koşulda çalışır (BAK-35), bu yüzden picker artık
          `linked` şartına bağlı DEĞİL. */}
      {vehicle && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelectBakimx={(p) => {
            void add(bakimxDraft(p))
            setTecdocOpen(false)
          }}
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
        onSubmit={submitManualDraft}
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

/** Composer'ın anlık toplamı — satır sütunuyla aynı sözleşme: tutar KDV DAHİL. */
function TotalPreview({ lineTotal, vatKurus }: { lineTotal: number | null; vatKurus: number | null }) {
  if (lineTotal == null) return null
  return (
    <span className="flex flex-col text-sm text-muted-foreground">
      <span>
        Toplam: <span className="font-semibold tabular-nums text-foreground">{formatTRY(lineTotal)}</span>
      </span>
      {vatKurus != null && vatKurus > 0 && <VatHint vatKurus={vatKurus} included />}
    </span>
  )
}

/**
 * Satırın tutarının ALTINDA duran küçük KDV notu (BAK-75 §3).
 *
 * Yazılışı ÜSTÜNDEKİ rakama göre değişir, yoksa not yanlış okunur:
 * - `included` yok → üstteki NET (birim fiyat), KDV onun ÜSTÜNE biner: "+₺20,00 KDV".
 * - `included` var → üstteki BRÜT (satır toplamı), KDV onun İÇİNDE: "₺20,00 KDV dahil".
 */
function VatHint({ vatKurus, className, included }: { vatKurus: number; className?: string; included?: boolean }) {
  return (
    <span className={cn("text-[11px] leading-tight tabular-nums text-muted-foreground", className)}>
      {included ? `${formatTRY(vatKurus)} KDV dahil` : `+${formatTRY(vatKurus)} KDV`}
    </span>
  )
}

// ── Satır-editör paylaşılan mantığı ─────────────────────────────────────────
// Masaüstü <tr>, mobil kart VE composer aynı state/işleyicileri bu hook'tan alır.
function useRowEditor(row: Row, vehicle: PickerVehicle | undefined, locked: boolean, onCell: OnCell) {
  const isPart = row.type === "part"
  const editable = !locked
  // Katalogdan seçilmiş parçanın KİMLİĞİ kilitlidir: ad, parça no ve marka
  // katalog verisidir — elle değiştirilirse satır artık gerçek parçayı göstermez
  // (ⓘ detay, fiyat karşılaştırma, sipariş hep yanlış parçayı işaret eder).
  // Miktar/fiyat/kategori düzenlenebilir kalır. Sunucu da reddeder
  // (updateOrderItemAction). `tecdocArticleId` YALNIZ TecDoc seçiminde,
  // `bakimxProductId` YALNIZ BakımX seçiminde dolar; ikisi de katalog kimliği.
  const identityLocked = isPart && (row.tecdocArticleId != null || row.bakimxProductId != null)
  const linked = vehicle?.catalogVehicleTypeId != null
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)
  const [filter, setFilter] = useState<PartFilter>({})

  const lineTotal = row.totalPrice != null && row.totalPrice > 0
    ? row.totalPrice
    : (row.unitPrice != null && row.unitPrice > 0 ? Math.round(row.unitPrice * row.quantity) : null)

  // BAK-75 — YAZILAN VE GÖSTERİLEN TUTAR HER ZAMAN NET. #311'in net↔brüt çevrimi
  // kaldırıldı: ₺100 yazan kullanıcı satırda ₺100 okur, ₺83,33 değil.
  //
  // BAK-55'in koşulu bu modelde de tutar — satırda görünen rakamın Genel
  // Toplam'da karşılığı vardır: net tutar Ara Toplam'a, `vatKurus` ise (tick
  // açıksa) KDV satırına gider. İki rakam da aynı `includeVat` bayrağından
  // beslenir; #354'ün kaldırdığı kopukluk bu yüzden geri gelmiyor.
  const { taxBps } = useVat()
  const vatLiable = row.includeVat !== false
  const vatKurus = vatLiable ? lineVatKurus(lineTotal, taxBps) : null

  // "Toplam" sütunu KDV DAHİL okunur (BAK-75 takibi). Kullanıcının satırda
  // gördüğü tutar cebinden çıkacak tutar olmalı; net toplam yazan sütun,
  // üstteki Genel Toplam ile tutmuyormuş gibi görünüyordu (4×₺100 satır,
  // ₺480 Genel Toplam). Tick kapalıyken brüt = net, sütun değişmez.
  //
  // Bu YALNIZ GÖSTERİMDİR: `vatKurus` satır bazlı hesaplanır, belge KDV'si ise
  // toplam matraha bir kez uygulanır (bkz. line-vat.ts). Genel Toplam'ı
  // besleyen tek yer totals.ts'tir, bu rakam değil.
  const grossLineTotal = lineTotal == null ? null : lineTotal + (vatKurus ?? 0)

  // BAK-91 — alış fiyatı kayıtlı kalemde (dış alım / BakımX) satış fiyatı hâlâ
  // maliyete eşit mi, altında mı. İkisi de NET kuruş olduğu için doğrudan
  // kıyaslanır; satırda gösterilen birim fiyat da net (BAK-75), yani kullanıcının
  // gördüğü iki rakam aynı tabandadır.
  const marginState = purchaseMarginState(row)

  function startPrice() { setPriceDraft(toPriceDraft(row.unitPrice)); setEditingPrice(true) }
  function commitPrice() {
    setEditingPrice(false)
    // Alan artık düz metin (bkz. PriceField): normal TRY girdisi mevcut parser'a,
    // işlem içeren girdi güvenli ifade ayrıştırıcısına gider.
    const entered = /[+*/×÷()]/.test(priceDraft) || /-(?!^)/.test(priceDraft)
      ? evaluateMoneyExpression(priceDraft)
      : parseTRYToKurus(priceDraft)
    if (entered == null || entered < 0) return
    if (entered !== row.unitPrice) onCell(row, { unitPrice: entered })
  }

  return {
    isPart, editable, identityLocked, linked, filter, setFilter,
    editingPrice, setEditingPrice, priceDraft, setPriceDraft,
    tecdocOpen, setTecdocOpen, lineTotal, grossLineTotal,
    vatLiable, vatKurus, marginState,
    startPrice, commitPrice,
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
/**
 * BAK-104 — `oneLine`: masaüstü tablo satırında ad TEK satırda kalır ve taşarsa
 * kırpılır. Sarmalı ad satır yüksekliğini iki-üç katına çıkarıp aynı satırdaki
 * miktar/fiyat/toplam hücrelerini dikeyde kaydırıyor, tablo tırtıklı okunuyordu.
 * Tam ad `title`'da (hover ipucu) ve mobil kartta sarılı hâliyle görünür.
 */
function PartIdentity({ row, oneLine }: { row: Row; oneLine?: boolean }) {
  const lockNote = row.bakimxProductId != null
    ? "BakımX kataloğundan eklendi — ad, parça no ve marka değiştirilemez"
    : row.tecdocArticleId != null
      ? "Katalogdan eklendi — ad, parça no ve marka değiştirilemez"
      : "Parça adı değiştirilemez — düzeltmek için satırı silip yeniden ekleyin"
  // Kırpılan adda `title` ÖNCE tam adı vermeli: kullanıcı hover'da okumak
  // istediği şey kilit gerekçesi değil, görünmeyen ad.
  const title = oneLine ? `${row.name} — ${lockNote}` : lockNote
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-0.5 py-1",
        oneLine ? "flex-nowrap" : "flex-wrap",
      )}
      title={title}
    >
      {row.sku && (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
          {row.sku}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 text-sm font-medium text-foreground",
          oneLine ? "truncate" : "whitespace-normal break-words",
        )}
      >
        {row.name}
      </span>
    </div>
  )
}

// Liste satırının ad hücresi. Parçada ad SALT-OKUNUR (bkz. PartIdentity);
// işçilikte serbest metin olarak düzenlenebilir (debounce'lu otosave çalışıyor).
//
// BAK-104 — satır-içi aksiyon ikonları (parça detayı ⓘ, tedarikçi fiyatı 🏷)
// BURADAN ÇIKARILDI. Ad hücresinin içinde durdukları için konumları satırdan
// satıra kayıyor (adın uzunluğuna göre), adın yerini yiyor ve dış alım
// satırında tür kolonundan taşan üçüncü ikonla üst üste biniyorlardı. Artık
// hepsi satırın sağındaki tek aksiyon grubunda (`RowActions`).
function PartField({ row, ed, onCell, oneLine }: {
  row: Row; ed: RowEditor; onCell: OnCell
  /** Masaüstü tablo satırı: ad tek satırda kırpılır (bkz. PartIdentity). */
  oneLine?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {ed.isPart ? (
        <PartIdentity row={row} oneLine={oneLine} />
      ) : (
        <Input
          value={row.name}
          onChange={(e) => onCell(row, { name: e.target.value }, { debounce: true })}
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

function QuantityField({ row, editable, onCell }: { row: Row; editable: boolean; onCell: OnCell }) {
  const unit = ORDER_ITEM_UNITS.find((candidate) => candidate === row.unit) ?? "adet"
  const [draft, setDraft] = useState(String(row.quantity))
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan doğrulanan miktarı alan taslağına taşır
    setDraft(String(row.quantity))
  }, [row.quantity])
  if (!editable) return <span className="text-sm tabular-nums">{row.quantity}</span>
  function commit() {
    const quantity = Number(draft.replace(",", "."))
    const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 999
      && Math.round(quantity * 1000) === quantity * 1000
      && (isDivisibleOrderItemUnit(unit) || Number.isInteger(quantity))
    if (!valid) {
      setDraft(String(row.quantity))
      return
    }
    setDraft(String(quantity))
    if (quantity !== row.quantity) onCell(row, { quantity })
  }
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={`${row.name || "Satır"} miktarı`}
      className="h-9 w-24 text-center text-sm tabular-nums"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur() }}
    />
  )
}

function UnitField({ row, editable, onCell }: { row: Row; editable: boolean; onCell: OnCell }) {
  const unit = ORDER_ITEM_UNITS.find((candidate) => candidate === row.unit) ?? "adet"
  if (row.type !== "part") return <span className="text-xs text-muted-foreground">—</span>
  if (!editable) return <span className="text-sm">{ORDER_ITEM_UNIT_LABELS[unit]}</span>
  return (
    <OrderItemUnitCombobox
      value={unit}
      ariaLabel={`${row.name || "Parça"} birimi`}
      className="h-9 w-24"
      isOptionDisabled={(candidate) =>
        (row.hasStockLink || !!row.__partId) && isDivisibleOrderItemUnit(candidate)}
      onValueChange={(next) => {
        onCell(row, {
          unit: next,
          ...(!isDivisibleOrderItemUnit(next) && !Number.isInteger(row.quantity) ? { quantity: Math.max(1, Math.round(row.quantity)) } : {}),
        })
      }}
    />
  )
}

/** Düzenlemeye açılan taslak: para birimi ve binlik ayraç YOK, ondalık virgüllü. */
function toPriceDraft(unitPriceKurus: number | null): string {
  return unitPriceKurus == null ? "" : String(kurusToLira(unitPriceKurus)).replace(".", ",")
}

// wide: composer/mobil'de sabit geniş genişlik (dar/sıkışık görünmesin). Masaüstü
// tablo hücresinde (dar kolon) varsayılan kompakt genişlik korunur.
// Kalem-butonuna basıp açma deseni yerine HER ZAMAN yazılabilir ₺ alanı —
// tecrübesiz kullanıcı fiyatın düzenlenebilir olduğunu görür. Odaklanınca lira
// taslağına geçer, blur/Enter'da kuruşa çevrilip commit edilir (useRowEditor).
//
// Düz shadcn `Input` — `type="number"` + ₺ eklentili InputGroup DEĞİL (BAK-53
// geri bildirimi): sayı girdisinin tarayıcı okları dar hücrede yer yiyor,
// tekerlek/ok tuşuyla fiyatı KAZARA değiştiriyor ve Türkçe klavyede virgüllü
// giriş ("120,50") tarayıcı tarafından geçersiz sayılıp sessizce boş
// gönderiliyordu. Metin alanında ₺ ve binlik ayraç GÖSTERİMDE kalır (odak yokken
// formatTRY), odaklanınca ham sayıya döner ve parseTRYToKurus her iki biçimi de
// okur.
//
// BAK-91 — alış fiyatı kayıtlı kalemde satış hâlâ maliyete eşit/altındaysa
// rakamın KENDİSİ renklenir: satır "hayalet" olduğu için kenarlık/zemin
// GHOST_ROW tarafından şeffaflanır (metin rengi ezilmez). Zararına satır
// destructive, revize edilmemiş satır warning — biri hata, öbürü hatırlatma.
const MARGIN_TONE: Record<PurchaseMarginState, string> = {
  none: "",
  unpriced: "",
  "at-cost": "text-warning-strong font-semibold",
  "below-cost": "text-destructive-strong font-semibold",
  "marked-up": "",
}

function PriceField({ row, ed, wide }: { row: Row; ed: RowEditor; wide?: boolean }) {
  const tone = MARGIN_TONE[ed.marginState]
  if (!ed.editable) {
    return (
      <span data-slot="price-field" className={cn("text-sm tabular-nums", tone, row.unitPrice == null && "text-muted-foreground")}>
        {row.unitPrice != null ? formatTRY(row.unitPrice) : "—"}
      </span>
    )
  }
  return (
    <Input
      data-slot="price-field"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="₺0,00"
      aria-label="Birim fiyat"
      className={cn("h-9 px-2.5 text-right text-sm tabular-nums", tone, wide ? "w-32" : "w-28")}
      value={ed.editingPrice ? ed.priceDraft : row.unitPrice != null ? formatTRY(row.unitPrice) : ""}
      onFocus={(e) => { if (!ed.editingPrice) ed.startPrice(); e.currentTarget.select() }}
      onChange={(e) => { if (!ed.editingPrice) ed.startPrice(); ed.setPriceDraft(e.target.value) }}
      onBlur={ed.commitPrice}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
    />
  )
}

/**
 * Birim Fiyat + (tick açıksa) altında küçük KDV notu (BAK-75 §3).
 *
 * Not BİRİM fiyatın değil SATIRIN KDV'sidir (miktarla çarpılmış): kullanıcının
 * Genel Toplam'da göreceği rakam bu. Miktar 1 iken ikisi zaten aynı.
 */
function PriceCell({ row, ed, wide, align = "end" }: {
  row: Row; ed: RowEditor; wide?: boolean; align?: "end" | "start"
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "end" ? "items-end" : "items-start")}>
      <PriceField row={row} ed={ed} wide={wide} />
      {ed.vatKurus != null && ed.vatKurus > 0 && <VatHint vatKurus={ed.vatKurus} className="pr-2.5" />}
      <PurchaseCostHint row={row} ed={ed} />
    </div>
  )
}

/**
 * Alış fiyatı ipucu (BAK-91) — birim fiyatın altında "Alış ₺300,00".
 *
 * İki işi birden yapar: fiyat revize edilmemişken uyarır, revize edildikten
 * SONRA da maliyeti görünür tutar (kullanıcı isteği: "satın alma fiyatını da bir
 * yerde görmeye devam edebilmesi lazım"). Alımın tedarikçi/tarih/fiş fotoğrafı
 * detayı hâlâ satır aksiyonlarındaki 🧾 "Satın alma detayı" adımında (bkz.
 * `RowActions`) — burası yalnız rakam, çünkü kapanışta bakılan şey rakam.
 *
 * Tutar NET'tir (KDV hariç) ve üstündeki birim fiyat da net gösterilir (BAK-75)
 * — iki rakam aynı tabanda, göz kıyaslaması doğru.
 */
function PurchaseCostHint({ row, ed }: { row: Row; ed: RowEditor }) {
  const state = ed.marginState
  if (!showsPurchaseCost(state)) return null
  const cost = row.purchasePriceKurus
  if (cost == null) return null

  const warn = needsMarkup(state)
  const percent = purchaseMarginPercent(row)
  const hint = purchaseMarginHint(state)
  const tooltip = [
    `Alış fiyatı: ${formatTRY(cost)} (KDV hariç)`,
    percent != null && !warn ? `Kâr marjı: %${percent}` : null,
    hint,
  ].filter(Boolean).join(" · ")

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={tooltip}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md text-[11px] leading-tight tabular-nums",
          state === "below-cost"
            ? "font-medium text-destructive-strong"
            : state === "at-cost"
              ? "font-medium text-warning-strong"
              : "text-muted-foreground",
        )}
      >
        {warn && <AlertTriangle className="size-3 shrink-0" />}
        <span className="truncate">Alış {formatTRY(cost)}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/**
 * "Toplam" hücresi — tutar KDV DAHİL, altında bunu söyleyen küçük not.
 *
 * Not olmadan sütun yanıltıcı: aynı satırda birim fiyat NET yazıyor, tick'e göre
 * toplam brütleşiyor; hangisinin hangisi olduğu rakamdan okunmuyordu.
 */
function TotalField({ lineTotal, strong, vatIncluded }: {
  lineTotal: number | null
  strong?: boolean
  vatIncluded?: boolean
}) {
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn(
        "tabular-nums",
        strong ? "text-[15px] font-bold tracking-tight" : "text-sm font-semibold",
        lineTotal == null ? "text-xs font-normal text-muted-foreground" : "text-foreground",
      )}>
        {lineTotal != null ? formatTRY(lineTotal) : "—"}
      </span>
      {lineTotal != null && vatIncluded && (
        <span className="text-[11px] leading-tight text-muted-foreground">KDV dahil</span>
      )}
    </span>
  )
}

// Tür çipi: tarama kolaylığı için tipe göre renkli ikon+etiket rozeti (mobil kart
// başlığı). Parça=lacivert, İşçilik=amber, Dış İşçilik=mor.
function TypeChip({ type }: { type: ItemType }) {
  const cfg: Record<ItemType, { Icon: typeof Wrench; cls: string }> = {
    part: { Icon: PackagePlus, cls: "bg-primary/10 text-primary-strong" },
    labor: { Icon: Wrench, cls: "bg-item-labor/10 text-item-labor-strong" },
    external_labor: { Icon: ExternalLink, cls: "bg-item-external/10 text-item-external-strong" },
  }
  const { Icon, cls } = cfg[type]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", cls)}>
      <Icon className="size-3.5" /> {TYPE_LABELS[type]}
    </span>
  )
}

// Kalemin kaynağını gösteren küçük rozet: katalog / manuel / dış alım / BakımX.
// Tooltip masaüstünde hover, mobilde dokun(focus)-ile açılır. source=null → rozet yok.
function SourceBadge({ source }: { source: OrderItem["source"] }) {
  if (!source) return null
  const map = {
    catalog: { Icon: PackageCheck, label: "Katalogdan eklendi", cls: "text-primary" },
    manual: { Icon: PencilLine, label: "Manuel eklendi", cls: "text-muted-foreground" },
    purchase: { Icon: ShoppingCart, label: "Dışarıdan alındı", cls: "text-primary" },
    bakimx: { Icon: Store, label: "BakımX kataloğundan eklendi", cls: "text-primary" },
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
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-success-strong", className)}>
      <Check className="size-3 shrink-0" />
      Yapıldı
      <span className="font-normal text-muted-foreground">· {stamp}</span>
    </span>
  )
}

function ProcurementBadge({ procurement }: { procurement?: OrderItem["externalProcurement"] }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  if (!procurement) return null
  const label = procurement.cancellationRequestedAt
    ? "İptal talebi iletildi"
    : procurement.status === "REQUESTED"
      ? "Tedarik bekleniyor"
      : procurement.status === "CONFIRMED"
        ? "Tedarik onaylandı"
        : procurement.status === "SHIPPED"
          ? "Sevkiyatta"
          : procurement.status === "COMPLETED"
            ? "Tedarik tamamlandı"
            : procurement.status === "CANCELLED"
              ? "Tedarik iptal edildi"
              : procurement.status === "FAILED" ? "Tedarik başarısız" : procurement.status
  async function requestCancellation() {
    setCancelling(true)
    try {
      const response = await fetch("/api/orders/external-procurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", procurementId: procurement!.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "İptal talebi iletilemedi.")
      toast.success("İptal talebi GetirBakım'a iletildi."); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : "İptal talebi iletilemedi.") }
    finally { setCancelling(false) }
  }
  return <span className="mt-1.5 flex flex-wrap items-center gap-2"><Badge variant="outline">{label}</Badge>{procurement.status === "CONFIRMED" && !procurement.cancellationRequestedAt ? <Button type="button" variant="link" size="sm" className="h-auto px-0 text-destructive-strong" disabled={cancelling} onClick={() => void requestCancellation()}>{cancelling ? "İletiliyor…" : "İptal talep et"}</Button> : null}</span>
}

// Başarılı otosave ("Kaydedildi") veya yeni ekleme ("Eklendi") sonrası 2 sn'lik
// onay işareti. Masaüstünde dar kolonlara sığması için iconOnly, mobil kart
// başlığında metinli sürüm.
function RowFlash({ kind, iconOnly }: { kind?: FlashKind | null; iconOnly?: boolean }) {
  if (!kind) return null
  const label = FLASH_LABELS[kind]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success-strong"
      title={label}
      aria-live="polite"
    >
      <CheckCircle2 className="size-3.5" />
      {!iconOnly && label}
    </span>
  )
}

// ── Satır aksiyonları: tek grup, en çok iki dokunma hedefi (BAK-104) ─────────
/**
 * Bir kalem satırının TÜM aksiyonları burada toplanır: parça detayı, tedarikçi
 * fiyat karşılaştırma, satın alma detayı ve sil.
 *
 * Neden tek grup: aksiyonlar önceden üç ayrı yere dağılmıştı (ⓘ ve 🏷 ad
 * hücresinin içinde, satın alma 🏷'i tür kolonunda, sil en sağda). Sonuç, dış
 * alım satırında tür kolonunun taşıp ikonun marka alanının üstüne binmesi ve
 * ikonların satırdan satıra yer değiştirmesiydi (Kızıldağ Oto geri bildirimi).
 *
 * İkiyi geçen aksiyon `splitRowActions` ile ⋯ menüsüne iner → aksiyon kolonu
 * her satırda aynı genişlikte, dokunma hedefleri ayrık kalır.
 *
 * Ayrıca satın alma detayı artık 🏷 (Tags) değil 🧾 (ReceiptText) ikonu
 * kullanır: aynı satırda tedarikçi fiyat karşılaştırma da 🏷 idi, iki farklı
 * aksiyon ayırt edilemiyordu.
 */
function RowActions({ row, ed, orderId, vehicle, onRemove, onShowDetail }: {
  row: Row
  ed: RowEditor
  orderId?: string
  vehicle?: PickerVehicle
  onRemove: (row: Row) => void
  onShowDetail: OnShowDetail
}) {
  const [priceOpen, setPriceOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const actions: Array<{
    key: string
    tone: "default" | "danger"
    label: string
    hint: string
    Icon: typeof Info
    run: () => void
  }> = []

  // Katalog bağlantılı kalem → özellik/görsel/uygunluk detayı. Eklemeden sonra
  // da erişilebilir olmalı (usta parçayı takarken ölçüye bakıyor).
  if (ed.isPart && row.tecdocArticleId != null) {
    actions.push({
      key: "detail", tone: "default", label: "Parça detayı",
      hint: "Özellikler, görsel ve uygunluk", Icon: Info,
      run: () => onShowDetail({
        target: {
          tecdocArticleId: row.tecdocArticleId!,
          productName: row.name,
          articleNo: row.sku ?? "",
          supplierName: row.brand ?? "",
          vehicleTypeId: vehicle?.catalogVehicleTypeId ?? null,
        },
      }),
    })
  }
  if (ed.isPart && row.name.trim() !== "") {
    actions.push({
      key: "price", tone: "default", label: "Tedarikçi fiyatları",
      hint: "Tedarikçi fiyatlarını karşılaştır", Icon: Tags,
      run: () => setPriceOpen(true),
    })
  }
  if (row.source === "purchase" && orderId) {
    actions.push({
      key: "purchase", tone: "default", label: "Satın alma detayı",
      hint: "Alış fiyatı, tedarikçi, tarih ve fiş fotoğrafı", Icon: ReceiptText,
      run: () => setPurchaseOpen(true),
    })
  }
  if (ed.editable) {
    actions.push({
      key: "delete", tone: "danger", label: "Satırı sil",
      hint: "Satırı sil", Icon: Trash2,
      run: () => setConfirmDelete(true),
    })
  }

  const { inline, overflow } = splitRowActions(actions)
  const byKey = new Map(actions.map((a) => [a.key, a]))

  return (
    <>
      {/* Dizilim: ⋯ önce, satır-içi aksiyonlar sonra. Yıkıcı aksiyon her zaman
          listenin sonunda kurulduğu için sil ikonu HER satırda en sağdaki
          slotta durur — bazı satırda ⋯ olup bazısında olmaması kolonu
          kaydırmaz. */}
      <div className="flex items-center justify-end gap-0.5">
        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${row.name || "Satır"} — diğer işlemler`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {overflow.map((a, i) => {
                const action = byKey.get(a.key)!
                const prev = i > 0 ? byKey.get(overflow[i - 1].key)! : null
                return (
                  <div key={action.key}>
                    {prev && prev.tone !== action.tone && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant={action.tone === "danger" ? "destructive" : "default"}
                      onClick={action.run}
                    >
                      <action.Icon className="size-4" />
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {inline.map((a) => {
          const action = byKey.get(a.key)!
          return (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={action.run}
                  aria-label={action.hint}
                  className={cn(
                    "text-muted-foreground",
                    action.tone === "danger"
                      ? "hover:bg-destructive/10 hover:text-destructive-strong"
                      : "hover:bg-muted hover:text-foreground",
                  )}
                >
                  <action.Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.hint}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Yıkıcı aksiyon onay ister — tek tıkla silinen kalem geri alınamıyordu. */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalem silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{row.name || "Adsız kalem"}</span>
              {" "}iş emrinden kaldırılacak ve toplamlardan düşecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { setConfirmDelete(false); onRemove(row) }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Yalnız aksiyonu VARSA mount edilir; işçilik satırları için teklif
          dialogu ve istemci durumu gereksiz yere kurulmasın. */}
      {byKey.has("price") && (
        <SupplierPriceDialog
          open={priceOpen}
          onOpenChange={setPriceOpen}
          part={{ name: row.name, sku: row.sku, brand: row.brand }}
          orderId={orderId}
          orderItemId={row.id}
          quantity={row.quantity}
        />
      )}

      {row.source === "purchase" && orderId && (
        <PurchaseDetailDialog
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          orderId={orderId}
          editable={ed.editable}
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
      )}
    </>
  )
}

// TecDoc modal — yalnız part satırı VE araç TecDoc'ta eşleşmişse mount edilir
// (eşleşmemişse picker VinLinkPrompt döner; 🔍 butonu zaten disabled). Portal
// ile render olduğu için <td>/kart/composer içine yerleştirmek güvenli.
//
// `onSelectBakimx` BİLEREK verilmez: bu seçici MEVCUT satırın parçasını
// değiştiriyor ve o yol PATCH'ten geçiyor. BakımX kalemi yalnız yazma anında
// tutarlı kurulabilir (alış fiyatı + `bakimxProductId` + `partId` boşluğu, bkz.
// bakimx-item.ts); PATCH bu alanları taşımadığı için satır yarı BakımX kalırdı.
// BakımX ürünü eklemek composer'dan (yukarıdaki 🔍 / arama) yapılır.
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
  if (!value) return <span className="text-[11px] text-muted-foreground">—</span>
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
  labor: "bg-item-labor",
  external_labor: "bg-item-external",
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
/**
 * Satır KDV anahtarı (BAK-53 / BAK-75). Varsayılan İŞARETSİZ: girilen tutar
 * NET'tir ve Genel Toplam'a olduğu gibi girer.
 *
 * İşaretlenince satır belgenin KDV'sine tabi olur — tutar DEĞİŞMEZ, üstüne KDV
 * biner (₺100 → Ara Toplam ₺100 + KDV ₺20 = ₺120) ve satırda "+₺20,00 KDV" notu
 * belirir. Belgede KDV oranı yoksa aynı tıkla standart %20 belgeye yazılır
 * (`ensureDocumentTax`), yoksa notta KDV yazarken toplama hiç KDV girmezdi.
 */
function VatCell({ row, ed, onCell }: { row: Row; ed: RowEditor; onCell: OnCell }) {
  const { ensureDocumentTax } = useVat()
  const label = ed.vatLiable ? "KDV ekleniyor" : "KDV eklenmiyor"
  if (!ed.editable) {
    return (
      <span className="text-xs text-muted-foreground" title={label}>
        {ed.vatLiable ? "KDV" : "—"}
      </span>
    )
  }
  return (
    <Checkbox
      checked={ed.vatLiable}
      onCheckedChange={(checked) => {
        const liable = checked === true
        if (liable) ensureDocumentTax()
        onCell(row, { includeVat: liable })
      }}
      aria-label={`${row.name || "Satır"} — ${label}`}
    />
  )
}

function DesktopPartRow({ row, orderId, locked, vehicle, showAttributes = true, onCell, onRemove, flash, onShowDetail }: {
  row: Row
  /** Yalnız iş emrinde dolu — dış alım detay modalı orderId ister. */
  orderId?: string
  locked: boolean
  vehicle?: PickerVehicle
  showAttributes?: boolean
  onCell: OnCell
  onRemove: (row: Row) => void
  flash?: FlashKind | null
  onShowDetail: OnShowDetail
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)
  const { perLine: vatPerLine } = useVat()
  const type = row.type as ItemType
  const showMeta = showAttributes && ed.isPart && (ed.editable || !!row.brand || !!row.category)

  return (
    <TableRow className={cn(GHOST_ROW, "align-middle")}>
      {/* Tür: sol renk aksanı (mutlak bar) + tür çipi + kaynak rozeti.
          BAK-104 — dış alım detay ikonu buradan ÇIKTI: çip + rozet + ikon üçlüsü
          w-40'lık kolona sığmıyor, ikon alt satıra düşüp ad kolonundaki
          Marka/Kategori satırının üstüne biniyordu. Artık `RowActions` içinde. */}
      <TableCell className="relative py-3.5 pl-[18px]">
        <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", ROW_ACCENT[type] ?? "bg-transparent")} />
        <div className="flex min-w-0 items-center gap-1.5">
          <TypeChip type={type} />
          <SourceBadge source={row.source} />
        </div>
      </TableCell>

      {/* Parça / İşçilik: ad (hayalet, tek satır — taşarsa kırpılır) + parça
          için Marka/Kategori meta satırı */}
      <TableCell className="whitespace-normal py-3.5">
        <div className="min-w-0">
          <PartField row={row} ed={ed} onCell={onCell} oneLine />
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
          <ProcurementBadge procurement={row.externalProcurement} />
        </div>
      </TableCell>

      {/* Miktar */}
      <TableCell className="py-3.5">
        <div className="flex justify-center">
          {ed.isPart
            ? <QuantityField row={row} editable={ed.editable} onCell={onCell} />
            : <QtyStepper row={row} editable={ed.editable} onCell={onCell} />}
        </div>
      </TableCell>

      {/* Birim — ondalıklı miktar yalnız litre seçiliyken geçerlidir. */}
      <TableCell className="py-3.5">
        <div className="flex justify-center">
          <UnitField row={row} editable={ed.editable} onCell={onCell} />
        </div>
      </TableCell>

      {/* KDV — satıra KDV eklensin mi (BAK-53 / BAK-75) */}
      {vatPerLine && (
        <TableCell className="py-3.5">
          <div className="flex justify-center">
            <VatCell row={row} ed={ed} onCell={onCell} />
          </div>
        </TableCell>
      )}

      {/* Birim Fiyat (net) + tick açıkken altında "+₺X KDV" notu */}
      <TableCell className="py-3.5">
        <div className="flex justify-end">
          <PriceCell row={row} ed={ed} wide />
        </div>
      </TableCell>

      {/* Toplam (vurgulu, KDV DAHİL) + otosave onayı — tutar tek satırda kalır */}
      <TableCell className="py-3.5 whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <RowFlash kind={flash} iconOnly />
          <TotalField lineTotal={ed.grossLineTotal} strong vatIncluded={ed.vatKurus != null && ed.vatKurus > 0} />
        </div>
      </TableCell>

      {/* Satır aksiyonları — tek grup, en çok iki dokunma hedefi (BAK-104).
          Artık hover'da belirmiyor: grup ad hücresinden buraya taşınan
          detay/fiyat aksiyonlarını da taşıyor, gizli kalırsa bulunamazlar. */}
      <TableCell className="py-3.5">
        <RowActions
          row={row}
          ed={ed}
          orderId={orderId}
          vehicle={vehicle}
          onRemove={onRemove}
          onShowDetail={onShowDetail}
        />
      </TableCell>
    </TableRow>
  )
}

// ── Mobil satırı: kart (çarşaf liste) ────────────────────────────────────────
function MobilePartRow({ row, orderId, locked, vehicle, showAttributes = true, onCell, onRemove, flash, onShowDetail }: {
  row: Row
  /** Yalnız iş emrinde dolu — dış alım detay modalı orderId ister. */
  orderId?: string
  locked: boolean
  vehicle?: PickerVehicle
  showAttributes?: boolean
  onCell: OnCell
  onRemove: (row: Row) => void
  flash?: FlashKind | null
  onShowDetail: OnShowDetail
}) {
  const ed = useRowEditor(row, vehicle, locked, onCell)
  const { perLine: vatPerLine } = useVat()
  const type = row.type as ItemType
  const showMeta = showAttributes && ed.isPart && (ed.editable || !!row.brand || !!row.category)

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 pl-4 shadow-sm">
      {/* Sol tür aksanı */}
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", ROW_ACCENT[type] ?? "bg-transparent")} />

      {/* Başlık: tür çipi + kaynak rozeti · satır aksiyonları (tek grup) */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <TypeChip type={type} />
          <SourceBadge source={row.source} />
          <RowFlash kind={flash} />
        </div>
        <RowActions
          row={row}
          ed={ed}
          orderId={orderId}
          vehicle={vehicle}
          onRemove={onRemove}
          onShowDetail={onShowDetail}
        />
      </div>

      {/* Parça / İşçilik adı (öne çıkan) — hayalet: kenarlıksız, odakta belirir */}
      <div className={cn(
        "mt-2",
        "[&_[data-slot=input-group]]:border-transparent [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input]]:border-transparent [&_[data-slot=input]]:bg-transparent",
        "[&_[data-slot=input-group]]:px-0 [&_[data-slot=input]]:!px-0 [&_[data-slot=input]]:font-medium",
        "focus-within:[&_[data-slot=input-group]]:border-input focus-within:[&_[data-slot=input]]:border-input focus-within:[&_[data-slot=input]]:!px-2.5",
      )}>
        <PartField row={row} ed={ed} onCell={onCell} />
        <RowTecdocPicker row={row} ed={ed} vehicle={vehicle} onCell={onCell} onShowDetail={onShowDetail} />
        <DoneBadge completedAt={row.completedAt} className="mt-1.5" />
        <ProcurementBadge procurement={row.externalProcurement} />
      </div>

      {/* Marka / Kategori — kompakt gri çipler (etiketsiz), yalnız parça */}
      {showMeta && (
        <div className={cn("mt-1.5 flex flex-wrap gap-1.5", META_FIELD_MOBILE)}>
          <div className="min-w-[7rem] flex-1"><AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare /></div>
          <div className="min-w-[7rem] flex-1"><AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} bare /></div>
        </div>
      )}

      {/* Fiş bloğu: Miktar/KDV bir satır, ardından ETİKETLİ tutar satırları.
          BAK-104 — eski düzen "Miktar · KDV · ₺Birim = ₺Toplam"ı tek satıra
          sığdırmaya çalışıyordu; 360px'lik ekranda (kart içi 296px) grup
          sarınca sağa yaslı iki çıplak rakam kalıyor, hangisinin birim hangisinin
          toplam olduğu okunmuyordu ("fiyat net gözükmüyor"). Artık her tutar
          kendi satırında, solda etiketi, sağda rakamı: kart genişliğine bakmadan
          daima tam görünür, yatay kaydırma gerekmez.
          Birim fiyat NET, Toplam KDV DAHİL. */}
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {ed.isPart
              ? <QuantityField row={row} editable={ed.editable} onCell={onCell} />
              : <QtyStepper row={row} editable={ed.editable} onCell={onCell} />}
            <UnitField row={row} editable={ed.editable} onCell={onCell} />
          </div>
          {vatPerLine && (
            <label className="flex h-9 items-center gap-1.5 text-xs text-muted-foreground">
              <VatCell row={row} ed={ed} onCell={onCell} />
              KDV ekle
            </label>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Birim fiyat</span>
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            <PriceField row={row} ed={ed} />
            <PurchaseCostHint row={row} ed={ed} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <span className="shrink-0 text-xs font-medium text-foreground">Toplam</span>
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            {/* `vatIncluded` VERİLMEZ: hemen altındaki VatHint zaten tutarıyla
                birlikte "₺X KDV dahil" yazıyor, ikisi birden "KDV dahil"i
                üst üste iki kez tekrar ediyordu. */}
            <TotalField lineTotal={ed.grossLineTotal} strong />
            {ed.vatKurus != null && ed.vatKurus > 0 && <VatHint vatKurus={ed.vatKurus} included />}
          </div>
        </div>
      </div>
    </div>
  )
}
