"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge, PaymentBadge } from "@/components/app/status-badge"
import { DetailHeader, type DetailHeaderAction } from "@/components/app/detail-header"
import type { OrderStatusKey } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira, percentToBps, bpsToPercent, applyDiscountKurus, applyTaxBps, addKurus } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/cashbox/status"
import type { PaymentMethodKey } from "@/lib/cashbox/status"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { generateWhatsAppShareText, getWhatsAppShareUrl, buildPublicLink } from "@/lib/share/whatsapp"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import {
  Plus,
  Trash2,
  Wrench,
  User,
  Car,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  Camera,
  Loader2,
  Share2,
  Printer,
  FileText,
  Pencil,
  X,
  Save,
  Receipt,
  Calculator,
  Info,
  Wallet,
  ChevronRight,
  Play,
  Send,
  CheckCircle2,
  Package,
  PackageCheck,
  KeyRound,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES } from "@/lib/constants"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { SendReminderButton } from "@/components/app/send-reminder-button"
import { formatPrice } from "@/lib/parts/format"
import { ServiceAdvisorPanel } from "@/components/app/service-advisor-panel"
import { AdvisorPremiumLock } from "@/components/app/advisor-premium-lock"

type OrderItem = {
  id: string
  type: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
}

type Totals = {
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

type DamageMark = {
  id: string
  zone: string
  damageType: string
  severity: string
  note: string | null
}

type Photo = {
  id: string
  type: string
  label: string
  required: boolean
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
}

type OrderDetailData = {
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
  vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
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
  damageMarks: DamageMark[]
  photos: Photo[]
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

type PricingMetaDraft = {
  technicianName: string
  estimatedDeliveryAt: string
  discountAmount: string
  taxRate: string
  notes: string
}

// `primary: true` marks the happy-path forward action (rendered as the single
// blue CTA); other forwards become secondary, `cancelled` becomes destructive.
const NEXT_STATUSES: Record<string, { key: OrderStatusKey; label: string; primary?: boolean }[]> = {
  draft: [{ key: "in_progress", label: "İşleme Al", primary: true }, { key: "waiting_approval", label: "Onaya Gönder" }],
  waiting_approval: [
    { key: "approved", label: "Onayla", primary: true },
    { key: "in_progress", label: "Onaysız Devam" },
    { key: "cancelled", label: "İptal" },
  ],
  approved: [{ key: "in_progress", label: "İşleme Başla", primary: true }, { key: "waiting_parts", label: "Parça Bekliyor" }],
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
  cancelled: [],
}

// Icon per target status, so header actions match the intake header's look.
const ORDER_ACTION_ICONS: Record<string, DetailHeaderAction["icon"]> = {
  waiting_approval: Send,
  approved: CheckCircle2,
  in_progress: Play,
  waiting_parts: Package,
  ready_for_delivery: PackageCheck,
  delivered: KeyRound,
  cancelled: XCircle,
}

export function OrderDetail({ order, technicians, hasAiAdvisor }: { order: OrderDetailData; technicians?: { id: string; fullName: string; role: string }[]; hasAiAdvisor: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [editingMeta, setEditingMeta] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [metaDraft, setMetaDraft] = useState({
    technicianName: order.technicianName || "",
    estimatedDeliveryAt: order.estimatedDeliveryAt
      ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16)
      : "",
    // Inputs show TRY/percent; stored values are kuruş/bps.
    discountAmount: order.discountAmount != null ? String(kurusToLira(order.discountAmount)) : "",
    taxRate: order.taxRate != null ? String(bpsToPercent(order.taxRate)) : "",
    notes: order.notes || "",
  })

  async function changeStatus(newStatus: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Durum güncellenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function saveMeta() {
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("technicianName", metaDraft.technicianName)
      formData.set("estimatedDeliveryAt", metaDraft.estimatedDeliveryAt)
      // Convert TRY -> kuruş and percent -> bps for the server.
      formData.set("discountAmount", String(liraToKurus(Math.max(0, Number(metaDraft.discountAmount) || 0))))
      formData.set("taxRate", String(percentToBps(Number(metaDraft.taxRate) || 0)))
      formData.set("notes", metaDraft.notes)

      const res = await fetch(`/api/orders/${order.id}/meta`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setEditingMeta(false)
        router.refresh()
      } else {
        setError(data.error || "Bilgiler güncellenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const nextActions = NEXT_STATUSES[order.status] || []
  const customerName =
    order.customer.type === "corporate"
      ? order.customer.companyName || "Kurumsal Müşteri"
      : order.customer.fullName ||
        `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() ||
        "Müşteri"
  // DetailHeader orders buttons (danger → secondary → primary); we only assign tones.
  const headerActions: DetailHeaderAction[] = nextActions.map((a) => ({
    key: a.key,
    label: a.label,
    onClick: () => changeStatus(a.key),
    tone: a.key === "cancelled" ? "danger" : a.primary ? "primary" : "secondary",
    icon: ORDER_ACTION_ICONS[a.key],
  }))
  const shareLink = order.intake.shareToken ? buildPublicLink(order.intake.shareToken) : null

  function handleWhatsApp() {
    if (!shareLink) return
    const text = generateWhatsAppShareText({
      publicLink: typeof window !== "undefined" ? `${window.location.origin}${shareLink}` : shareLink,
      totalAmount: order.totals.hasAnyPrice ? order.totals.grandTotal : null,
    })
    window.open(getWhatsAppShareUrl(text), "_blank")
  }

  async function addAiItems(items: Array<{ type: "labor" | "part"; name: string }>, _customerDescription: string, _internalNote: string) {
    setLoading(true)
    setError("")
    try {
      for (const item of items) {
        const formData = new FormData()
        formData.set("serviceOrderId", order.id)
        formData.set("type", item.type)
        formData.set("name", item.name)
        formData.set("quantity", "1")
        const res = await fetch("/api/orders/items", { method: "POST", body: formData })
        const data = await res.json()
        if (!data.success) {
          setError(data.error || "Kalem eklenemedi")
          break
        }
      }
      window.location.reload()
    } catch {
      setError("AI önerileri eklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <DetailHeader
        plate={order.vehicle.plate}
        vehicleLabel={`${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}`}
        customerLabel={customerName}
        badges={
          <>
            <StatusBadge status={order.status} size="lg" />
            <PaymentBadge status={order.paymentStatus} size="lg" />
          </>
        }
        actions={headerActions}
        loading={loading}
        onBack={() => router.push("/orders")}
      />

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground text-sm flex items-start gap-2">
          <Info className="size-4 text-destructive shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <CustomerVehicleCard
            customer={order.customer}
            vehicle={order.vehicle}
            intake={order.intake}
          />

          <PartsLaborCard
            orderId={order.id}
            items={order.items}
            onError={setError}
            onLoading={setLoading}
            loading={loading}
          />

          <ComplaintNotesCard intake={order.intake} />

          {hasAiAdvisor ? (
            <ServiceAdvisorPanel
              intakeFormId={order.intake.id}
              customerComplaint={order.intake.customerComplaint}
              vehicleBrand={order.vehicle.brand}
              vehicleModel={order.vehicle.model}
              mileage={order.intake.mileageAtIntake ?? order.vehicle.mileage}
              onAddItems={addAiItems}
            />
          ) : (
            <AdvisorPremiumLock />
          )}

          {order.damageMarks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning" />
                  Araç Hasar Haritası ({order.damageMarks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {order.damageMarks.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 bg-muted rounded-lg text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: (DAMAGE_SEVERITY as Record<string, { color: string }>)[d.severity]?.color || "#9CA3AF" }}
                        />
                        <span className="font-medium truncate">
                          {VEHICLE_ZONES[d.zone as keyof typeof VEHICLE_ZONES] || d.zone}
                        </span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {DAMAGE_TYPES[d.damageType as keyof typeof DAMAGE_TYPES]?.label || d.damageType}
                        </span>
                      </div>
                      {d.note && <span className="text-xs text-muted-foreground truncate max-w-[40%]">- {d.note}</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Link
                    href={`/intakes/${order.intake.id}`}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    Hasar haritasını tam ekranda görüntüle →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {order.photos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="size-4 text-muted-foreground" />
                  Fotoğraflar ({order.photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {order.photos.slice(0, 8).map((p, i) => (
                    <PhotoThumb key={p.id} photo={p} onOpen={() => setLightboxIndex(i)} />
                  ))}
                </div>
                {order.photos.length > 8 && (
                  <Link
                    href={`/intakes/${order.intake.id}`}
                    className="mt-3 block text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    Tüm fotoğrafları gör ({order.photos.length}) →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          <PhotoLightbox
            photos={order.photos.slice(0, 8).map((p): LightboxPhoto => ({
              id: p.id,
              label: PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]?.label || p.type,
              fileUrl: `/api/photos?id=${p.id}`,
            }))}
            index={lightboxIndex ?? 0}
            onIndexChange={setLightboxIndex}
            open={lightboxIndex !== null}
            onOpenChange={(o) => {
              if (!o) setLightboxIndex(null)
            }}
          />
        </div>

        <div className="lg:col-span-1 space-y-5">
          <PricingSummaryCard
            orderId={order.id}
            totals={order.totals}
            paymentStatus={order.paymentStatus}
            paidAmount={order.paidAmount}
            remainingAmount={order.remainingAmount}
            editingMeta={editingMeta}
            setEditingMeta={setEditingMeta}
            metaDraft={metaDraft}
            setMetaDraft={setMetaDraft}
            saveMeta={saveMeta}
            loading={loading}
          />

          <PaymentHistoryCard
            orderId={order.id}
            isCancelled={order.status === "cancelled"}
            totals={order.totals}
            paidAmount={order.paidAmount}
            remainingAmount={order.remainingAmount}
            collections={order.collectionHistory}
            customerId={order.customer.id}
            customerName={order.customer.type === "corporate" ? (order.customer.companyName || "Kurumsal Müşteri") : (order.customer.fullName || `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Müşteri")}
          />

          <OrderInfoCard order={order} onChangeStatus={changeStatus} loading={loading} technicians={technicians} />

          <ShareCard shareLink={shareLink} onWhatsApp={handleWhatsApp} />
        </div>
      </div>
    </div>
  )
}

function CustomerVehicleCard({
  customer,
  vehicle,
  intake,
}: {
  customer: OrderDetailData["customer"]
  vehicle: OrderDetailData["vehicle"]
  intake: OrderDetailData["intake"]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Müşteri & Araç</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <User className="size-3" /> Müşteri
            </div>
            <p className="text-sm font-semibold text-foreground">
              {customer.type === "corporate"
                ? customer.companyName || "Kurumsal Müşteri"
                : customer.fullName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Müşteri"}
            </p>
            {customer.type === "corporate" && customer.contactName ? (
              <p className="text-xs text-muted-foreground">Yetkili: {customer.contactName}</p>
            ) : null}
            <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
              <Phone className="size-3.5" />
              {customer.phone}
            </a>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                <Mail className="size-3.5" />
                {customer.email}
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Car className="size-3" /> Araç
            </div>
            <p className="text-sm font-semibold text-foreground">
              {vehicle.brand} {vehicle.model}
              {vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {intake.mileageAtIntake != null && <span>Giriş KM: {intake.mileageAtIntake.toLocaleString("tr-TR")}</span>}
              {vehicle.mileage != null && <span>Kayıtlı: {vehicle.mileage.toLocaleString("tr-TR")} km</span>}
              {vehicle.vin && <span className="font-mono">VIN: {vehicle.vin}</span>}
            </div>
          </div>
        </div>
        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Kabul: {formatDate(intake.createdAt)}</span>
          {intake.approvedAt && <span>Onay: {formatDate(intake.approvedAt)}</span>}
          <Link href={`/intakes/${intake.id}`} className="text-primary hover:text-primary/80 font-medium">
            Kabul Detayı →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function PartsLaborCard({
  orderId,
  items,
  onError,
  onLoading,
  loading,
}: {
  orderId: string
  items: OrderItem[]
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
}) {
  const [addingType, setAddingType] = useState<"part" | "labor" | null>(null)
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [unit, setUnit] = useState("adet")
  const [qty, setQty] = useState("1")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("")
  const [catalogSearch, setCatalogSearch] = useState("")
  const [catalogResults, setCatalogResults] = useState<Array<{ id: string; name: string; sku: string | null; stockQty: number; criticalStockQty: number; salePrice: number | null; unit: string; isActive: boolean }>>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)

  const parts = items.filter((i) => i.type === "part")
  const labor = items.filter((i) => i.type === "labor")

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

  async function selectCatalogPart(partId: string) {
    const part = catalogResults.find((p) => p.id === partId)
    if (!part) return
    setName(part.name)
    setSku(part.sku || "")
    setUnit(part.unit)
    // Catalog prices are kuruş; the input holds TRY (lira).
    setPrice(part.salePrice != null ? String(kurusToLira(part.salePrice)) : "")
    setQty("1")
    setShowCatalog(false)
    setCatalogSearch("")
    setCatalogResults([])
  }

  function resetForm() {
    setName("")
    setSku("")
    setUnit("adet")
    setQty("1")
    setPrice("")
    setNote("")
    setAddingType(null)
    setShowCatalog(false)
    setCatalogSearch("")
    setCatalogResults([])
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

    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        resetForm()
        // Soft refresh via reload since we use revalidatePath
        window.location.reload()
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
      window.location.reload()
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
                <ItemRow key={item.id} item={item} lineTotal={lineTotal(item)} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}
        {labor.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">İşçilikler ({labor.length})</p>
            <div className="space-y-1.5">
              {labor.map((item) => (
                <ItemRow key={item.id} item={item} lineTotal={lineTotal(item)} onRemove={handleRemove} />
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

        {!addingType ? (
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

function ItemRow({ item, lineTotal, onRemove }: { item: OrderItem; lineTotal: number | null; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
          {item.sku && <span className="text-[10px] font-mono text-muted-foreground bg-white px-1.5 py-0.5 rounded border border-border">{item.sku}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.quantity} {item.unit || (item.type === "part" ? "adet" : "saat")}
          {item.unitPrice ? ` × ${formatTRY(item.unitPrice)}` : ""}
          {item.note && ` • ${item.note}`}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className={cn("text-sm font-semibold", lineTotal == null ? "text-muted-foreground/70 font-normal text-xs" : "text-foreground")}>
          {lineTotal != null ? formatTRY(lineTotal) : "—"}
        </span>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
          aria-label="Kalemi sil"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function ComplaintNotesCard({ intake }: { intake: OrderDetailData["intake"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Şikayet & Notlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Müşteri Şikayeti</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{intake.customerComplaint}</p>
        </div>
        {intake.internalNote && (
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Teknisyen İç Notu</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{intake.internalNote}</p>
            <p className="mt-1 text-[11px] text-muted-foreground italic">Bu not müşteri çıktısında gösterilmez</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PricingSummaryCard({
  totals,
  paymentStatus,
  paidAmount,
  remainingAmount,
  editingMeta,
  setEditingMeta,
  metaDraft,
  setMetaDraft,
  saveMeta,
  loading,
}: {
  orderId: string
  totals: Totals
  paymentStatus: string
  paidAmount: number
  remainingAmount: number
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
          {editingMeta ? (
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

function OrderInfoCard({
  order,
  technicians,
}: {
  order: OrderDetailData
  onChangeStatus: (s: string) => void
  loading: boolean
  technicians?: { id: string; fullName: string; role: string }[]
}) {
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
                <button
                  onClick={handleUnassign}
                  disabled={isPending}
                  className="text-[11px] text-foreground hover:text-foreground/80 underline disabled:opacity-50"
                >
                  Kaldır
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground/70">—</span>
            )}
          </div>
        </div>
        {technicians && technicians.length > 0 && (
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

function ShareCard({ shareLink, onWhatsApp }: { shareLink: string | null; onWhatsApp: () => void }) {
  if (!shareLink) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="size-4 text-muted-foreground" />
            Müşteri Çıktısı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
            Müşteri çıktı linki henüz oluşturulmadı. Link, kabul onayından sonra <Link href="/intakes" className="text-primary font-medium">Araç Kabul</Link> ekranından oluşturulabilir.
          </div>
        </CardContent>
      </Card>
    )
  }

  const pdfLink = `${shareLink}/pdf`

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="size-4 text-muted-foreground" />
          Müşteri Çıktısı
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={shareLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation"
        >
          <FileText className="size-4 text-muted-foreground" />
          Müşteri Çıktısını Aç
        </Link>
        <Link
          href={pdfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation"
        >
          <Printer className="size-4 text-muted-foreground" />
          Yazdır / PDF
        </Link>
        <button
          type="button"
          onClick={onWhatsApp}
          className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-[#25D366] hover:bg-[#25D366]/90 text-white text-sm font-medium transition-colors touch-manipulation"
        >
          <Share2 className="size-4" />
          WhatsApp ile Paylaş
        </button>
        <div className="pt-2">
          <p className="text-[11px] text-muted-foreground break-all">{shareLink}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Paylaşım için WhatsApp butonunu kullanın</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentHistoryCard({
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
              const isCancelled = c.status === "cancelled"
              return (
                <Link
                  key={c.id}
                  href={`/cashbox/payments/${c.id}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isCancelled ? "bg-destructive/10 hover:bg-destructive/10 border border-destructive/20" : "bg-muted hover:bg-muted"}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isCancelled ? "text-destructive line-through" : "text-foreground"}`}>{formatTRY(c.amount)}</p>
                      <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[11px] font-medium ${isCancelled ? "bg-destructive/10 text-foreground border-destructive/20" : "bg-success/10 text-foreground border-success/20"}`}>
                        {isCancelled ? "İptal" : methodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.paymentDate)}</p>
                    {isCancelled && c.cancellationReason && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{c.cancellationReason}</p>
                    )}
                    {!isCancelled && c.referenceNo && (
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

function PhotoThumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block aspect-square rounded-lg bg-muted border border-border overflow-hidden hover:border-primary/40 transition-colors"
      title={typeLabel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photos?id=${photo.id}`} alt={typeLabel} className="w-full h-full object-cover" />
    </button>
  )
}
