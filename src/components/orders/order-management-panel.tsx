"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentBadge } from "@/components/shared/status-badge"
import type { OrderStatusKey } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { liraToKurus, percentToBps, applyDiscountKurus, applyTaxBps, addKurus } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/cashbox/status"
import type { PaymentMethodKey } from "@/lib/cashbox/status"
import type {
  TechnicianChecklistItem,
  TechnicianInternalNote,
  TechnicianLaborSession,
} from "@/components/orders/technician-progress-panel"
import { formatDate } from "@/lib/utils-client"
import {
  Plus,
  Wrench,
  Loader2,
  Pencil,
  Save,
  Calculator,
  Wallet,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SendReminderButton } from "@/components/orders/send-reminder-button"
import { PartsLaborGrid } from "@/components/orders/parts-labor-grid"
import type { LaborCatalogRow } from "@/lib/labor/types"
import type { PartsRequestRow } from "@/components/orders/parts-request-panel"
import { CollectionQuickModal } from "@/components/cashbox/collection-quick-modal"

export type OrderItem = {
  id: string
  type: string
  name: string
  sku: string | null
  unit: string | null
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
  // BakımX ürün kataloğu bağlantısı (BAK-35) — doluysa satırın kimliği katalogdan
  // gelir ve düzenlenemez. FK değildir: fiyat kalemde donmuş anlık görüntüdür.
  bakimxProductId?: string | null
  // Kalemin nasıl eklendiği (katalog/manuel/dış alım/BakımX kataloğu); eski
  // satırlarda null.
  source: "catalog" | "manual" | "purchase" | "bakimx" | null
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
}

export type Totals = {
  partsTotal: number
  laborTotal: number
  externalLaborTotal: number
  subtotal: number
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
  paymentStatus: string
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
  laborCatalog,
  taxRateBps,
  onApplyStandardTax,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: { id: string; catalogVehicleTypeId: number | null; vin: string | null; modelYear: number | null; engineDisplacement: string | null; enginePower: string | null; fuelType: string | null; firstRegistrationDate: string | null }
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
  laborCatalog: LaborCatalogRow[]
  /** İş emrinin KDV oranı (bps) — kalem tutarlarının KDV dahil gösterimi için (#311). */
  taxRateBps?: number | null
  /** KDV oranı tanımsızken standart %20'yi iş emrine uygular. */
  onApplyStandardTax?: () => void
}) {
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
      <CardContent>
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
        />
      </CardContent>
    </Card>
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
        <SummaryRow label="Dış İşçilik Toplamı" value={totals.externalLaborCount > 0 ? formatTRY(totals.externalLaborTotal) : "—"} muted={totals.externalLaborCount === 0} />
        {/* Kalemlerin toplamı = ARA TOPLAM. Burada "Genel Toplam" yazıyordu
            (99aa6e3) ve kartta iki Genel Toplam satırı vardı: kalem
            toplamlarının hemen altındaki indirim/KDV uygulanmış rakam
            "kalemler tutmuyor" gibi okunuyordu (BAK-55). */}
        <div className="border-t pt-2 mt-2">
          <SummaryRow label="Ara Toplam" value={totals.hasAnyPrice ? formatTRY(totals.subtotal) : "—"} bold />
        </div>
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
            {/* İndirim/KDV satırları yalnız değer varken görünür; ikisi de sıfırken
                alttaki "+ İndirim / KDV ekle" butonu tek giriş noktasıdır. */}
            {totals.discountAmount > 0 && (
              <SummaryRow label="İndirim" value={formatTRY(totals.discountAmount)} />
            )}
            {totals.taxAmount > 0 && (
              <SummaryRow label={`KDV (${orderTaxRateDisplay(totals)})`} value={formatTRY(totals.taxAmount)} />
            )}
            <div className="border-t pt-2 mt-2">
              <SummaryRow label="Genel Toplam" value={totals.hasAnyPrice ? formatTRY(totals.grandTotal) : "—"} bold large />
            </div>
          </>
        )}

        {/* Tahsilat satırları Genel Toplam'ın ALTINDA: hesap zinciri (kalemler →
            ara toplam → indirim/KDV → genel toplam) araya ödeme girmeden okunur. */}
        {paidAmount > 0 && (
          <>
            <SummaryRow label="Tahsil Edilen" value={formatTRY(paidAmount)} bold tone="emerald" />
            <SummaryRow label="Kalan Bakiye" value={formatTRY(remainingAmount)} bold tone={remainingAmount > 0 ? "rose" : "emerald"} />
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
          ) : totals.discountAmount === 0 && totals.taxAmount === 0 ? (
            <Button
              variant="ghost"
              onClick={() => setEditingMeta(true)}
              size="sm"
              className="w-full text-primary hover:text-primary"
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
  const toneColor = tone === "emerald" ? "text-success-strong" : tone === "rose" ? "text-destructive-strong" : "text-foreground"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(muted ? "text-muted-foreground/70" : toneColor, large && "text-lg font-bold text-foreground", bold && !large && toneColor)}>
        {value}
      </span>
    </div>
  )
}

export function PaymentHistoryCard({
  orderId,
  collectionsLocked,
  totals,
  paidAmount,
  remainingAmount,
  collections,
  customerId,
  customerName,
}: {
  orderId: string
  collectionsLocked: boolean
  totals: Totals
  paidAmount: number
  remainingAmount: number
  collections: Array<{ id: string; amount: number; method: string; status: string; paymentDate: string; referenceNo: string | null; note: string | null; cancellationReason: string | null }>
  customerId: string
  customerName: string
}) {
  const cancelledCollections = collections.filter((c) => c.status === "cancelled")
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            Tahsilat Geçmişi
          </CardTitle>
          {!collectionsLocked && (
            <Button size="sm" onClick={() => setCollectionModalOpen(true)}>
              <Plus className="size-3.5 mr-1" />
              Tahsilat Ekle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {collections.length === 0 ? (
          <div className="text-center py-4">
            <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Henüz tahsilat kaydı yok</p>
            {!collectionsLocked && (
              <Button
                variant="link"
                className="mt-2 h-auto p-0 text-sm font-medium"
                onClick={() => setCollectionModalOpen(true)}
              >
                <Plus className="size-3.5 mr-1" /> İlk tahsilatı ekle
              </Button>
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
                      <p className={`text-sm font-semibold ${isRowCancelled ? "text-destructive-strong line-through" : "text-foreground"}`}>{formatTRY(c.amount)}</p>
                      <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[11px] font-medium ${isRowCancelled ? "bg-destructive/10 text-foreground border-destructive/20" : "bg-success/10 text-foreground border-success/20"}`}>
                        {isRowCancelled ? "İptal" : methodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.paymentDate)}</p>
                    {isRowCancelled && c.cancellationReason && (
                      <p className="text-xs text-destructive-strong mt-0.5 truncate">{c.cancellationReason}</p>
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

      {!collectionsLocked && (
        <CollectionQuickModal
          open={collectionModalOpen}
          onOpenChange={setCollectionModalOpen}
          orderId={orderId}
          customerId={customerId}
          grandTotal={totals.grandTotal}
          paidAmount={paidAmount}
          remainingAmount={remainingAmount}
        />
      )}
    </Card>
  )
}
