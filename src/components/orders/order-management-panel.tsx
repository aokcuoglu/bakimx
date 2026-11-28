"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DetailPanel, DetailPill, DetailEmpty, DetailItem, OrderPaymentPill, detail, surface } from "@/components/orders/order-detail-surface"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { OrderStatusKey } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { liraToKurus, percentToBps } from "@/lib/money"
import { computeDiscountedTotals } from "@/lib/totals"
import { PAYMENT_METHOD_LABELS } from "@/lib/cashbox/status"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { formatChainAmount, orderTotalsChain, totalsChainText } from "@/lib/orders/totals-chain"
import type { PaymentMethodKey } from "@/lib/cashbox/status"
import type {
  TechnicianChecklistItem,
  TechnicianInternalNote,
  TechnicianLaborSession,
} from "@/components/orders/technician-progress-panel"
import { formatDate } from "@/lib/utils-client"
import {
  Plus,
  Loader2,
  Pencil,
  Wallet,
  PackagePlus,
  ShoppingCart,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SendReminderButton } from "@/components/orders/send-reminder-button"
import { PartsLaborGrid, type PartsAddType, type PurchaseAddContext } from "@/components/orders/parts-labor-grid"
import pl from "./parts-labor.module.css"
import type { LaborCatalogRow } from "@/lib/labor/types"
import type { PartsRequestRow } from "@/components/orders/parts-request-panel"
import { CollectionQuickModal } from "@/components/cashbox/collection-quick-modal"

export type OrderItem = {
  id: string
  type: string
  name: string
  sku: string | null
  unit: string | null
  hasStockLink?: boolean
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  /**
   * Satır belgenin KDV'sine tabi mi (BAK-53). `false` ise hem satır tutarı KDV'siz
   * gösterilir hem de Genel Toplam'a KDV'siz girer — gösterim ve hesap AYNI
   * bayraktan beslenir (bkz. src/lib/totals.ts, BAK-55).
   */
  includeVat?: boolean | null
  note: string | null
  brand: string | null
  category: string | null
  categoryId: number | null
  // TecDoc katalog bağlantısı — doluysa satırda parça detayı (ⓘ) açılabilir.
  tecdocArticleId?: number | null
  // BakımX ürün kataloğu bağlantısı (BAK-35) — doluysa sku/marka/kategori
  // katalog kimliğidir (görünen ad transaction-only override edilebilir).
  // FK değildir: fiyat kalemde donmuş anlık görüntüdür.
  bakimxProductId?: string | null
  getirbakimProductId?: string | null
  // Kalemin nasıl eklendiği (katalog/manuel/dış alım/BakımX/GetirBakım); eski
  // satırlarda null.
  source: "catalog" | "manual" | "purchase" | "bakimx" | "getirbakim" | null
  // Alış fiyatı (kuruş, KDV hariç). İki kaynakta dolar: dış alım (source=purchase)
  // ve BakımX kalemi (source=bakimx). unitPrice bundan ön-doldurulur, sonra ayrı
  // düzenlenir.
  purchasePriceKurus?: number | null
  supplierName?: string | null
  supplierId?: string | null
  purchasedAt?: string | null
  purchasedByName?: string | null
  purchasePhotoId?: string | null
  // Dolu ⇒ kalem sahada teknisyen tarafından "yapıldı" işaretlenmiş.
  completedAt?: string | null
  externalProcurement?: {
    id: string
    status: string
    cancellationRequestedAt: string | null
    /** GetirBakım v2.0 cancellation summary (see procurementCancellationCode). */
    cancellationCode?: string | null
    /** Binding total incl. VAT and the VAT-inclusive shipping fee. */
    grossKurus?: number | null
    shippingKurus?: number | null
  } | null
}

export type Totals = {
  partsTotal: number
  laborTotal: number
  externalLaborTotal: number
  subtotal: number
  /** KDV'ye tabi kalemlerin net toplamı (önizleme için). */
  taxableSubtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  hasAnyPrice: boolean
  partsCount: number
  laborCount: number
  externalLaborCount: number
}

export type OrderDetailData = {
  id: string
  workOrderNo: string
  status: string
  /** Gösterilen ödeme durumu: kasa açıkken tutarlardan türetilir (#912, page.tsx). */
  paymentStatus: string
  /**
   * Yeni tahsilat kapalı mı (iptal emir ya da teslim edilmiş ve ödenmiş). Sunucuda,
   * tahsilat action'ının kapısıyla aynı girdiden (önbellekteki ödeme durumu) hesaplanır.
   */
  collectionsLocked: boolean
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  assignedAt: string | null
  completedAt: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  notes: string | null
  invoiceNo: string | null
  /** ISO string; kartta GG.AA.YYYY olarak gösterilir. */
  invoiceDate: string | null
  /** ArrivalReason enum anahtarı; etiket için arrivalReasonLabel kullanılır. */
  arrivalReason: string | null
  discountAmount: number | null
  taxRate: number | null
  totals: Totals
  items: OrderItem[]
  partsRequests: PartsRequestRow[]
  // Teknisyen sekmesi — salt okunur, düzenleme teknisyen panelinde kalır.
  checklistItems: TechnicianChecklistItem[]
  laborSessions: TechnicianLaborSession[]
  internalNotes: TechnicianInternalNote[]
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
    fuelLevelAtIntake: number | null
    customerComplaint: string
    internalNote: string | null
    droppedOffByName: string | null
    droppedOffByPhone: string | null
    pickedUpByName: string | null
    pickedUpByPhone: string | null
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
//
// #912 — durum YALNIZ başlıktan değişir (bilgi kartındaki Durum Select'i kalktı).
// Bu yüzden harita durum makinesinin sunduğu her hedefi taşır: anahtar kümesi
// `orderStatusOptions(s).slice(1)` ile birebir aynıdır (header-actions.test.ts).
// Başlıktaki iptal her durumda onay penceresi açar (work-order-detail.tsx).
export const NEXT_STATUSES: Record<string, { key: OrderStatusKey; label: string; primary?: boolean }[]> = {
  // Onay artık teslimde (delivery OTP) alınır, kabulde değil (bkz. status-transitions.ts).
  // Taslak iş emri doğrudan başlar; "Onaya Gönder" kaldırıldı. waiting_approval sadece
  // eski kayıtlar ileri gidebilsin diye durur (onay jargonu olmadan).
  draft: [
    { key: "in_progress", label: "Başla", primary: true },
    { key: "cancelled", label: "İptal" },
  ],
  waiting_approval: [
    { key: "in_progress", label: "Başla", primary: true },
    { key: "cancelled", label: "İptal" },
  ],
  approved: [
    { key: "in_progress", label: "Başla", primary: true },
    { key: "waiting_parts", label: "Parça Bekliyor" },
    { key: "cancelled", label: "İptal" },
  ],
  in_progress: [
    { key: "waiting_parts", label: "Parça Bekliyor" },
    { key: "ready_for_delivery", label: "Teslime Hazır", primary: true },
    { key: "cancelled", label: "İptal" },
  ],
  waiting_parts: [
    { key: "in_progress", label: "Devam Et", primary: true },
    { key: "ready_for_delivery", label: "Teslime Hazır" },
    { key: "cancelled", label: "İptal" },
  ],
  ready_for_delivery: [
    { key: "delivered", label: "Teslim Edildi", primary: true },
    // Teslimden önce işe geri dönmek (ör. son kontrolde eksik çıktı).
    { key: "in_progress", label: "İşleme Geri Al" },
    { key: "cancelled", label: "İptal" },
  ],
  delivered: [],
  cancelled: [{ key: "draft", label: "Yeniden Aktif Et", primary: true }],
}

/**
 * Kalemler paneli. Ekleme düğmesi sayfada tek yerde (#912): grid'in araç çubuğu
 * bu kabukta gizli (parts-labor.module.css), hızlı işlemler (#881) ve başlıktaki
 * "Kalem ekle" menüsü aynı pencereyi açar. Menü, hızlı işlem satırından uzakta
 * (uzun sayfada Kalemler'e kaydırılmışken) ekleme yolu kalsın diye durur.
 */
export function PartsLaborCard({
  orderId,
  status,
  items,
  vehicle,
  onError,
  onLoading,
  loading,
  laborCatalog,
  taxRateBps,
  onApplyStandardTax,
  addingType,
  onAddingTypeChange,
  rememberAddOpener,
  onAddDialogCloseAutoFocus,
  totals,
  onNavigateToPayment,
  purchase = null,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: { id: string; catalogVehicleTypeId: number | null; vin: string | null; modelYear: number | null; engineDisplacement: string | null; enginePower: string | null; fuelType: string | null; firstRegistrationDate: string | null }
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
  laborCatalog: LaborCatalogRow[]
  /** İş emrinin KDV oranı (bps) — satır KDV notunun oranı (BAK-75). */
  taxRateBps?: number | null
  /** Bir satırın KDV tick'i açılırken oran tanımsızsa standart %20'yi iş emrine yazar. */
  onApplyStandardTax?: () => void
  /**
   * Ekleme penceresi dışarıdan yönetilir: hızlı işlemler (#881) ve başlıktaki
   * "Kalem ekle" menüsü açar. Zorunlu — kabuk grid araç çubuğunu her zaman
   * gizlediği için (#912) başka ekleme yolu yok.
   */
  addingType: PartsAddType | null
  onAddingTypeChange: (type: PartsAddType | null) => void
  /**
   * "Kalem ekle" menüsü pencereyi açarken menünün düğmesini bildirir; pencere
   * kapanınca odak oraya döner (#913). Menü öğesi o anda DOM'dan kalkar.
   */
  rememberAddOpener?: (opener: HTMLElement | null) => void
  onAddDialogCloseAutoFocus?: (event: Event) => void
  /**
   * Sayfanın tek toplam kaynağı (`order.totals`). Verilirse tek kolonda Kalemler'in
   * sonunda Genel Toplam satırı çıkar; iki kolonda para raydaki Ödeme kartındadır (#967).
   */
  totals?: Totals
  /** Toplam satırının "Ödeme" bağlantısı: Ödeme bölümüne kaydırır. */
  onNavigateToPayment?: () => void
  /**
   * Dış alım ekleme bağlamı (#1070). Yalnız `procurement` + `parts.purchase`
   * varken dolu; menüde "Dış alım parça" ve Parça ekle diyaloğunda Dış Alım kipi.
   */
  purchase?: PurchaseAddContext | null
}) {
  const canAdd = !isOrderLocked(status as OrderStatus)
  // Dış alım formu araç kataloğu araması ister (bkz. PartsLaborEditor).
  const canAddPurchase = purchase != null && vehicle != null
  const addMenuTriggerRef = useRef<HTMLButtonElement>(null)
  return (
    <DetailPanel
      title="Parçalar & İşçilikler"
      aside={
        <span className="flex items-center gap-2">
          <span className={surface.rowEndText}>{items.length} kalem</span>
          {canAdd && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={addMenuTriggerRef} type="button" variant="ghost" size="icon" aria-label="Kalem ekle">
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    rememberAddOpener?.(addMenuTriggerRef.current)
                    onAddingTypeChange("parca")
                  }}
                >
                  <PackagePlus className="size-4" />
                  Parça ekle
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    rememberAddOpener?.(addMenuTriggerRef.current)
                    onAddingTypeChange("iscilik")
                  }}
                >
                  <Wrench className="size-4" />
                  İşçilik ekle
                </DropdownMenuItem>
                {canAddPurchase && (
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => {
                      rememberAddOpener?.(addMenuTriggerRef.current)
                      onAddingTypeChange("dis_alim")
                    }}
                  >
                    <ShoppingCart className="size-4" />
                    Dış alım parça
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      }
    >
      <div className={pl.skin}>
        <PartsLaborGrid
          orderId={orderId}
          status={status}
          items={items}
          vehicle={vehicle}
          onError={onError}
          onLoading={onLoading}
          loading={loading}
          laborCatalog={laborCatalog}
          taxRateBps={taxRateBps}
          onApplyStandardTax={onApplyStandardTax}
          addingType={addingType}
          onAddingTypeChange={onAddingTypeChange}
          onAddDialogCloseAutoFocus={onAddDialogCloseAutoFocus}
          compactRows
          purchase={canAddPurchase ? purchase : null}
        />
      </div>
      {totals?.hasAnyPrice && (
        <ItemsTotalFooter totals={totals} taxRateBps={taxRateBps ?? null} onNavigateToPayment={onNavigateToPayment} />
      )}
    </DetailPanel>
  )
}

/**
 * Tek kolonda (telefon / dar içerik) Kalemler'in sonundaki yapışkan olmayan toplam
 * (#967). Rakamlar Ödeme kartıyla AYNI kaynaktan gelir (`order.totals`, zincir
 * `orderTotalsChain`) — burada hiçbir şey yeniden hesaplanmaz. İki kolonda (içerik
 * ≥780px, `@container detail`) ray zaten Ödeme kartını gösterdiği için gizlenir;
 * eşik order-detail.module.css'teki iki kolon geçişiyle aynıdır.
 */
function ItemsTotalFooter({ totals, taxRateBps, onNavigateToPayment }: {
  totals: Totals
  taxRateBps: number | null
  onNavigateToPayment?: () => void
}) {
  const chainText = totalsChainText(orderTotalsChain(totals, taxRateBps))
  return (
    <div className={cn(detail.block, "flex items-start justify-between gap-3 @min-[780px]/detail:hidden")} data-testid="items-total">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[15px] leading-5 text-muted-foreground">
          Genel Toplam{" "}
          <span className="font-semibold tabular-nums text-foreground">{formatTRY(totals.grandTotal)}</span>
        </p>
        {chainText && <p className="text-[13px] leading-[18px] tabular-nums text-muted-foreground">{chainText}</p>}
      </div>
      <Button asChild variant="link" size="inline" className="shrink-0">
        <a
          href="#odeme"
          onClick={(event) => {
            event.preventDefault()
            onNavigateToPayment?.()
          }}
        >
          Ödeme
        </a>
      </Button>
    </div>
  )
}

/**
 * Raydaki Ödeme kartı (#912) — sayfada paranın TEK yeri. Eskiden aynı rakamlar
 * dört yerde duruyordu (tutar şeridi, Fiyatlandırma, Ödemeler'deki "Ödeme
 * Özeti" ve tahsilat geçmişinin altındaki toplam bloğu) ve ödenen tutar iki
 * farklı etiketle, iki farklı kaynaktan okunabiliyordu. Tahsil edilen tutar
 * sayfada tek kaynaktan gelir (`orderPaidKurus`, page.tsx); etiket tektir.
 *
 * Sıra hesap zinciridir: (Ara Toplam → İndirim → KDV) → Genel Toplam, sonra
 * Tahsil Edilen ve Kalan. Zincir indirim/KDV varken hep görünür (BAK-55);
 * kalem türü dökümü açılır satırdadır.
 */
export function OrderPaymentCard({
  totals,
  taxRateBps,
  paymentStatus,
  paidAmount,
  remainingAmount,
  locked,
  setEditingMeta,
  showCashbox = true,
  onCollect,
}: {
  totals: Totals
  /** Belgenin KDV oranı (bps) — KDV satırı gerçek oranı yazar. */
  taxRateBps: number | null
  paymentStatus: string
  paidAmount: number
  remainingAmount: number
  locked: boolean
  setEditingMeta: (b: boolean) => void
  showCashbox?: boolean
  /**
   * Tahsilat alınabiliyorsa; hızlı işlemdeki "Tahsilat al" ile aynı pencere.
   * Düğmeyi alır: pencere kapanınca odak oraya döner (#913).
   */
  onCollect?: (opener: HTMLElement) => void
}) {
  const chain = orderTotalsChain(totals, taxRateBps)
  // Fiyat girilmeden alınmış avans da görünür; kalan ancak toplam varken anlamlı.
  const showPaid = showCashbox && (totals.hasAnyPrice || paidAmount > 0)
  return (
    <DetailPanel title="Ödeme Özeti" aside={showCashbox && <OrderPaymentPill status={paymentStatus} />}>
      {totals.hasAnyPrice ? (
        <div className={cn(detail.block, "space-y-2")}>
          {/* Zincir açılır satırın DIŞINDA: Genel Toplam'ın neden kalem
              toplamından farklı olduğu katlanmadan okunur (BAK-55). */}
          {chain.map((row) => (
            <SummaryRow key={row.key} label={row.label} value={formatChainAmount(row.amount)} />
          ))}
          <div className={cn(chain.length > 0 && "border-t pt-2")}>
            <SummaryRow label="Genel Toplam" value={formatTRY(totals.grandTotal)} bold large />
          </div>
        </div>
      ) : (
        <DetailEmpty>Henüz tutar girilmedi</DetailEmpty>
      )}

      {showPaid && (
        <div className={cn(detail.block, "space-y-2")}>
          <SummaryRow label="Tahsil Edilen" value={formatTRY(paidAmount)} bold tone="emerald" />
          {totals.hasAnyPrice && (
            <SummaryRow label="Kalan" value={formatTRY(remainingAmount)} bold tone={remainingAmount > 0 ? "rose" : "emerald"} />
          )}
        </div>
      )}

      {totals.hasAnyPrice && (
        <div className={detail.disclosure}>
          <Accordion type="single" collapsible>
            <AccordionItem value="kalem-dokumu">
              <AccordionTrigger>Kalem dökümü</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <SummaryRow label="Parça Toplamı" value={totals.partsCount > 0 ? formatTRY(totals.partsTotal) : "—"} muted={totals.partsCount === 0} />
                  <SummaryRow label="İşçilik Toplamı" value={totals.laborCount > 0 ? formatTRY(totals.laborTotal) : "—"} muted={totals.laborCount === 0} />
                  <SummaryRow label="Dış İşçilik Toplamı" value={totals.externalLaborCount > 0 ? formatTRY(totals.externalLaborTotal) : "—"} muted={totals.externalLaborCount === 0} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <div className={cn(detail.block, "space-y-2")}>
        {onCollect && (
          <Button variant="foreground" onClick={(event) => onCollect(event.currentTarget)} className="w-full">
            <Wallet aria-hidden /> Tahsilat al
          </Button>
        )}
        {locked ? (
          <p className="text-xs text-muted-foreground text-center">
            Teslim edilmiş veya iptal edilmiş araç kabulünde fiyatlandırma düzenlenemez
          </p>
        ) : totals.discountAmount === 0 && totals.taxAmount === 0 ? (
          <Button
            variant="tint-ghost"
            onClick={() => setEditingMeta(true)}
            size="sm"
            className="w-full"
          >
            <Plus className="size-3.5 mr-1" /> İndirim / KDV ekle
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setEditingMeta(true)}
            size="sm"
            className="w-full"
          >
            <Pencil className="size-3.5 mr-1" /> İndirim & KDV Düzenle
          </Button>
        )}
      </div>
    </DetailPanel>
  )
}

/**
 * "İndirim ve KDV düzenle" penceresi (#966). Ödeme kartı iki yuvada render
 * edildiği için (dar düzende ana kolon, iki kolonda ray) durumlu pencere
 * kartın içinde kalamaz: sayfada tek kopya, kartlardan bağımsız.
 */
export function OrderPricingDialog({
  totals,
  editingMeta,
  setEditingMeta,
  metaDraft,
  setMetaDraft,
  saveMeta,
  loading,
  error,
}: {
  totals: Totals
  editingMeta: boolean
  setEditingMeta: (b: boolean) => void
  metaDraft: PricingMetaDraft
  setMetaDraft: (v: PricingMetaDraft) => void
  saveMeta: () => void
  loading: boolean
  error?: string
}) {
  const preview = previewDraftTotals(totals, metaDraft)
  return (
    <Dialog open={editingMeta} onOpenChange={(open) => { if (!loading) setEditingMeta(open) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>İndirim ve KDV düzenle</DialogTitle>
          <DialogDescription>Araç kabulünün toplamına uygulanacak indirim ve KDV oranını girin.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="order-discount">İndirim (₺)</Label>
            <Input id="order-discount" type="number" min="0" step="0.01" value={metaDraft.discountAmount} onChange={(e) => setMetaDraft({ ...metaDraft, discountAmount: e.target.value })} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="order-tax">KDV Oranı (%)</Label>
            <Input id="order-tax" type="number" min="0" max="100" step="0.1" value={metaDraft.taxRate} onChange={(e) => setMetaDraft({ ...metaDraft, taxRate: e.target.value })} placeholder="0" />
          </div>
          <SummaryRow label="KDV Tutarı" value={totals.hasAnyPrice && preview.taxAmount > 0 ? formatTRY(preview.taxAmount) : "—"} muted />
          <div className="border-t pt-2"><SummaryRow label="Genel Toplam" value={totals.hasAnyPrice ? formatTRY(preview.grandTotal) : "—"} bold large /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingMeta(false)} disabled={loading}>İptal</Button>
          <Button variant="foreground" onClick={saveMeta} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Draft fields are TRY (lira) / percent. Preview only — same helper as the saved total.
function previewDraftTotals(totals: Totals, draft: { discountAmount: string; taxRate: string }) {
  return computeDiscountedTotals(
    totals.subtotal,
    totals.taxableSubtotal,
    liraToKurus(Number(draft.discountAmount) || 0),
    percentToBps(Number(draft.taxRate) || 0),
  )
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
  const toneColor = tone === "emerald" ? "text-success-strong" : tone === "rose" ? "text-destructive-strong" : "text-foreground"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(muted ? "text-muted-foreground" : toneColor, large && "text-lg font-bold text-foreground", bold && !large && toneColor)}>
        {value}
      </span>
    </div>
  )
}

/**
 * Ödemeler bölümündeki tahsilat listesi. Toplamlar burada YOK (#912): Genel
 * Toplam, Tahsil Edilen ve Kalan yalnız Ödeme kartında. "Tahsilat al" da
 * oradan ve hızlı işlemden açılır; pencere burada durur, yalnız dışarıdan açılır.
 */
export function PaymentHistoryCard({
  orderId,
  collectionsLocked,
  grandTotal,
  hasAnyPrice,
  paidAmount,
  remainingAmount,
  collections,
  customerId,
  customerName,
  collectionModalOpen,
  onCollectionModalOpenChange,
  onCollectionModalCloseAutoFocus,
}: {
  orderId: string
  collectionsLocked: boolean
  grandTotal: number
  hasAnyPrice: boolean
  paidAmount: number
  remainingAmount: number
  collections: Array<{ id: string; amount: number; method: string; status: string; paymentDate: string; referenceNo: string | null; note: string | null; cancellationReason: string | null }>
  customerId: string
  customerName: string
  /** Tahsilat penceresi Ödeme kartından ve hızlı işlemden açılır (#881, #912). */
  collectionModalOpen: boolean
  onCollectionModalOpenChange: (open: boolean) => void
  /** Pencere kapanınca odağı açan düğmeye döndürür (#913). */
  onCollectionModalCloseAutoFocus?: (event: Event) => void
}) {
  return (
    <>
      <DetailPanel title="Tahsilat Geçmişi">
        {collections.length === 0 ? (
          <div className={detail.group}>
            <DetailEmpty>Henüz tahsilat kaydı yok</DetailEmpty>
          </div>
        ) : (
          <div className={detail.group}>
            {collections.map((c) => {
              const methodLabel = PAYMENT_METHOD_LABELS[c.method as PaymentMethodKey] || c.method
              const isRowCancelled = c.status === "cancelled"
              return (
                <DetailItem
                  key={c.id}
                  href={`/cashbox/payments/${c.id}`}
                  title={
                    <span className={cn("tabular-nums font-semibold", isRowCancelled && "text-destructive-strong line-through")}>
                      {formatTRY(c.amount)}
                    </span>
                  }
                  sub={
                    isRowCancelled ? (
                      c.cancellationReason ? (
                        <span className="text-destructive-strong">{c.cancellationReason}</span>
                      ) : undefined
                    ) : c.referenceNo ? (
                      <>Ref: {c.referenceNo}</>
                    ) : undefined
                  }
                  meta={formatDate(c.paymentDate)}
                  end={
                    <DetailPill tone={isRowCancelled ? "destructive" : "neutral"}>
                      {isRowCancelled ? "İptal" : methodLabel}
                    </DetailPill>
                  }
                />
              )
            })}
          </div>
        )}
        {remainingAmount > 0 && hasAnyPrice && (
          <div className={cn(detail.group, detail.block)}>
            <SendReminderButton
              customerId={customerId}
              serviceOrderId={orderId}
              customerName={customerName}
              remainingAmount={remainingAmount}
            />
          </div>
        )}
      </DetailPanel>

      {!collectionsLocked && (
        <CollectionQuickModal
          open={collectionModalOpen}
          onOpenChange={onCollectionModalOpenChange}
          orderId={orderId}
          customerId={customerId}
          grandTotal={grandTotal}
          paidAmount={paidAmount}
          remainingAmount={remainingAmount}
          onCloseAutoFocus={onCollectionModalCloseAutoFocus}
        />
      )}
    </>
  )
}
