"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge, PaymentBadge, PlateBadge } from "@/components/app/status-badge"
import type { OrderStatusKey } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/cashbox/status"
import type { PaymentMethodKey } from "@/lib/cashbox/status"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { generateWhatsAppShareText, getWhatsAppShareUrl, buildPublicLink } from "@/lib/share/whatsapp"
import {
  ArrowLeft,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES } from "@/lib/constants"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { formatPrice } from "@/lib/parts/format"

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
    paymentDate: string
    referenceNo: string | null
    note: string | null
  }>
}

type PricingMetaDraft = {
  technicianName: string
  estimatedDeliveryAt: string
  discountAmount: string
  taxRate: string
  notes: string
}

const NEXT_STATUSES: Record<string, { key: OrderStatusKey; label: string }[]> = {
  draft: [{ key: "in_progress", label: "İşleme Al" }, { key: "waiting_approval", label: "Onaya Gönder" }],
  waiting_approval: [
    { key: "approved", label: "Onayla" },
    { key: "in_progress", label: "Onaysız Devam" },
    { key: "cancelled", label: "İptal" },
  ],
  approved: [{ key: "in_progress", label: "İşleme Başla" }, { key: "waiting_parts", label: "Parça Bekliyor" }],
  in_progress: [
    { key: "waiting_parts", label: "Parça Bekliyor" },
    { key: "ready_for_delivery", label: "Teslime Hazır" },
  ],
  waiting_parts: [
    { key: "in_progress", label: "Devam Et" },
    { key: "ready_for_delivery", label: "Teslime Hazır" },
  ],
  ready_for_delivery: [{ key: "delivered", label: "Teslim Edildi" }, { key: "cancelled", label: "İptal" }],
  delivered: [],
  cancelled: [],
}

export function OrderDetail({ order }: { order: OrderDetailData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaDraft, setMetaDraft] = useState({
    technicianName: order.technicianName || "",
    estimatedDeliveryAt: order.estimatedDeliveryAt
      ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16)
      : "",
    discountAmount: order.discountAmount?.toString() || "",
    taxRate: order.taxRate?.toString() || "",
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
      formData.set("discountAmount", metaDraft.discountAmount)
      formData.set("taxRate", metaDraft.taxRate)
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
  const shareLink = order.intake.shareToken ? buildPublicLink(order.intake.shareToken) : null

  function handleWhatsApp() {
    if (!shareLink) return
    const text = generateWhatsAppShareText({
      publicLink: typeof window !== "undefined" ? `${window.location.origin}${shareLink}` : shareLink,
      totalAmount: order.totals.hasAnyPrice ? order.totals.grandTotal : null,
    })
    window.open(getWhatsAppShareUrl(text), "_blank")
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <button onClick={() => router.push("/app/orders")} className="hover:text-slate-700 inline-flex items-center gap-1 touch-manipulation">
          <ArrowLeft className="size-3.5" />
          İş Emirleri
        </button>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{order.workOrderNo}</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PlateBadge plate={order.vehicle.plate} />
          <StatusBadge status={order.status} size="md" />
          <PaymentBadge status={order.paymentStatus} size="md" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {order.customer.type === "corporate"
            ? order.customer.companyName || "Kurumsal Müşteri"
            : order.customer.fullName || `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Müşteri"}
        </h2>
        <p className="text-sm text-slate-500">
          {order.vehicle.brand} {order.vehicle.model}
          {order.vehicle.modelYear ? ` • ${order.vehicle.modelYear}` : ""}
        </p>
      </div>

      {nextActions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500 font-medium mr-1">Durumu Güncelle:</span>
              {nextActions.map((a) => (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.key === "cancelled" ? "outline" : "default"}
                  onClick={() => changeStatus(a.key)}
                  disabled={loading}
                  className={cn(
                    a.key === "cancelled" && "text-rose-600 border-rose-200 hover:bg-rose-50"
                  )}
                >
                  {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
                  {a.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
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

          {order.damageMarks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Araç Hasar Haritası ({order.damageMarks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {order.damageMarks.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: (DAMAGE_SEVERITY as Record<string, { color: string }>)[d.severity]?.color || "#9CA3AF" }}
                        />
                        <span className="font-medium truncate">
                          {VEHICLE_ZONES[d.zone as keyof typeof VEHICLE_ZONES] || d.zone}
                        </span>
                        <span className="text-slate-500 text-xs shrink-0">
                          {DAMAGE_TYPES[d.damageType as keyof typeof DAMAGE_TYPES]?.label || d.damageType}
                        </span>
                      </div>
                      {d.note && <span className="text-xs text-slate-500 truncate max-w-[40%]">- {d.note}</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Link
                    href={`/app/intakes/${order.intake.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                  <Camera className="size-4 text-slate-500" />
                  Fotoğraflar ({order.photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {order.photos.slice(0, 8).map((p) => (
                    <PhotoThumb key={p.id} photo={p} />
                  ))}
                </div>
                {order.photos.length > 8 && (
                  <Link
                    href={`/app/intakes/${order.intake.id}`}
                    className="mt-3 block text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Tüm fotoğrafları gör ({order.photos.length}) →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
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
            totals={order.totals}
            paidAmount={order.paidAmount}
            remainingAmount={order.remainingAmount}
            paymentStatus={order.paymentStatus}
            collections={order.collectionHistory}
            customerId={order.customer.id}
          />

          <OrderInfoCard order={order} onChangeStatus={changeStatus} loading={loading} />

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
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <User className="size-3" /> Müşteri
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {customer.type === "corporate"
                ? customer.companyName || "Kurumsal Müşteri"
                : customer.fullName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Müşteri"}
            </p>
            {customer.type === "corporate" && customer.contactName ? (
              <p className="text-xs text-slate-500">Yetkili: {customer.contactName}</p>
            ) : null}
            <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600">
              <Phone className="size-3.5" />
              {customer.phone}
            </a>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600">
                <Mail className="size-3.5" />
                {customer.email}
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Car className="size-3" /> Araç
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {vehicle.brand} {vehicle.model}
              {vehicle.modelYear ? ` (${vehicle.modelYear})` : ""}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              {intake.mileageAtIntake != null && <span>Giriş KM: {intake.mileageAtIntake.toLocaleString("tr-TR")}</span>}
              {vehicle.mileage != null && <span>Kayıtlı: {vehicle.mileage.toLocaleString("tr-TR")} km</span>}
              {vehicle.vin && <span className="font-mono">VIN: {vehicle.vin}</span>}
            </div>
          </div>
        </div>
        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Kabul: {formatDate(intake.createdAt)}</span>
          {intake.approvedAt && <span>Onay: {formatDate(intake.approvedAt)}</span>}
          <Link href={`/app/intakes/${intake.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
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
    setPrice(part.salePrice?.toString() || "")
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
    if (price) formData.set("unitPrice", price)
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
            <Wrench className="size-4 text-slate-500" />
            Kullanılan Parçalar & İşçilikler
          </CardTitle>
          <span className="text-xs text-slate-500">{items.length} kalem</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Parçalar ({parts.length})</p>
            <div className="space-y-1.5">
              {parts.map((item) => (
                <ItemRow key={item.id} item={item} lineTotal={lineTotal(item)} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}
        {labor.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">İşçilikler ({labor.length})</p>
            <div className="space-y-1.5">
              {labor.map((item) => (
                <ItemRow key={item.id} item={item} lineTotal={lineTotal(item)} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-500">
            <Wrench className="size-10 mx-auto mb-2 text-slate-300" />
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
            <Button size="sm" variant="ghost" disabled className="text-slate-400">
              <Plus className="size-3.5 mr-1" /> Barkodla Ekle <span className="ml-1 text-[10px] uppercase">Yakında</span>
            </Button>
          </div>
        ) : (
            <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {addingType === "part" ? "Yeni Parça" : "Yeni İşçilik"}
              </p>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 p-1"
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
                    {catalogLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Aranıyor...</span>}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCatalog(!showCatalog)}>
                    Katalogdan Ekle
                  </Button>
                </div>
                {showCatalog && catalogResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {catalogResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectCatalogPart(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          {p.sku && <span className="text-xs text-slate-500 ml-2 font-mono">{p.sku}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StockStatusBadge stockQty={p.stockQty} criticalStockQty={p.criticalStockQty} isActive={p.isActive} />
                          {p.salePrice != null && <span className="text-xs font-medium text-slate-700">{formatPrice(p.salePrice)}</span>}
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
    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
          {item.sku && <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.sku}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {item.quantity} {item.unit || (item.type === "part" ? "adet" : "saat")}
          {item.unitPrice ? ` × ${formatTRY(item.unitPrice)}` : ""}
          {item.note && ` • ${item.note}`}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className={cn("text-sm font-semibold", lineTotal == null ? "text-slate-400 font-normal text-xs" : "text-slate-900")}>
          {lineTotal != null ? formatTRY(lineTotal) : "—"}
        </span>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
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
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Müşteri Şikayeti</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{intake.customerComplaint}</p>
        </div>
        {intake.internalNote && (
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Teknisyen İç Notu</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{intake.internalNote}</p>
            <p className="mt-1 text-[11px] text-slate-500 italic">Bu not müşteri çıktısında gösterilmez</p>
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
            <Calculator className="size-4 text-slate-500" />
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
            <SummaryRow label="KDV Tutarı" value={totals.hasAnyPrice && (metaDraft.taxRate ? Number(metaDraft.taxRate) : 0) > 0 ? formatTRY((Math.max(0, totals.subtotal - (Number(metaDraft.discountAmount) || 0)) * (Number(metaDraft.taxRate) || 0)) / 100) : "—"} muted />
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

function calculatePreviewTotal(subtotal: number, draft: { discountAmount: string; taxRate: string }) {
  const discount = Math.max(0, Number(draft.discountAmount) || 0)
  const after = Math.max(0, subtotal - discount)
  const tax = (after * (Number(draft.taxRate) || 0)) / 100
  return after + tax
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
  const toneColor = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-slate-900"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-slate-600", bold && "text-slate-900")}>{label}</span>
      <span className={cn(muted ? "text-slate-400" : toneColor, large && "text-lg font-bold text-slate-900", bold && !large && toneColor)}>
        {value}
      </span>
    </div>
  )
}

function OrderInfoCard({
  order,
}: {
  order: OrderDetailData
  onChangeStatus: (s: string) => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-slate-500" />
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
        <InfoRow label="Teknisyen" value={order.technicianName || "—"} />
        {order.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 mb-1">Notlar</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
        <div className="pt-2 border-t">
          <p className="text-xs text-slate-500 mb-1.5">Ödeme</p>
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
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn("text-sm text-slate-900 flex items-center gap-1.5", mono && "font-mono text-xs")}>
        {Icon && <Icon className="size-3.5 text-slate-400" />}
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
            <Share2 className="size-4 text-slate-500" />
            Müşteri Çıktısı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            Müşteri çıktı linki henüz oluşturulmadı. Link, kabul onayından sonra <Link href="/app/intakes" className="text-blue-600 font-medium">Araç Kabulleri</Link> üzerinden oluşturulabilir.
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
          <Share2 className="size-4 text-slate-500" />
          Müşteri Çıktısı
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={shareLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-700 touch-manipulation"
        >
          <FileText className="size-4 text-slate-500" />
          Müşteri Çıktısını Aç
        </Link>
        <Link
          href={pdfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-700 touch-manipulation"
        >
          <Printer className="size-4 text-slate-500" />
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
          <p className="text-[11px] text-slate-500 break-all">{shareLink}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Paylaşım için WhatsApp butonunu kullanın</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentHistoryCard({
  orderId,
  totals,
  paidAmount,
  remainingAmount,
  collections,
}: {
  orderId: string
  totals: Totals
  paidAmount: number
  remainingAmount: number
  paymentStatus: string
  collections: Array<{ id: string; amount: number; method: string; paymentDate: string; referenceNo: string | null; note: string | null }>
  customerId: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="size-4 text-slate-500" />
            Tahsilat Geçmişi
          </CardTitle>
          <Link
            href={`/app/cashbox/payments/new?orderId=${orderId}`}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors touch-manipulation"
          >
            <Plus className="size-3" />
            Tahsilat Ekle
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {collections.length === 0 ? (
          <div className="text-center py-4">
            <Wallet className="size-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">Henüz tahsilat kaydı yok</p>
            <Link
              href={`/app/cashbox/payments/new?orderId=${orderId}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="size-3.5" /> İlk tahsilatı ekle
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {collections.map((c) => {
              const methodLabel = PAYMENT_METHOD_LABELS[c.method as PaymentMethodKey] || c.method
              return (
                <Link
                  key={c.id}
                  href={`/app/cashbox/payments/${c.id}`}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{formatTRY(c.amount)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(c.paymentDate)} &bull; {methodLabel}</p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
        {paidAmount > 0 && totals.hasAnyPrice && (
          <div className="border-t pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Genel Toplam</span>
              <span className="font-medium text-slate-900">{formatTRY(totals.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Tahsil Edilen</span>
              <span className="font-medium text-emerald-700">{formatTRY(paidAmount)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Kalan</span>
              <span className={cn("font-bold", remainingAmount > 0 ? "text-rose-700" : "text-emerald-700")}>{formatTRY(remainingAmount)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PhotoThumb({ photo }: { photo: Photo }) {
  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type
  return (
    <Link
      href={`/api/photos?id=${photo.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden hover:border-blue-400 transition-colors"
      title={typeLabel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photos?id=${photo.id}`} alt={typeLabel} className="w-full h-full object-cover" />
    </Link>
  )
}
