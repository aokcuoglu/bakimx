"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DetailHeader, type DetailHeaderAction } from "@/components/app/detail-header"
import { StatusBadge, PaymentBadge } from "@/components/app/status-badge"
import {
  Car,
  User,
  Phone,
  Mail,
  ClipboardList,
  Camera,
  AlertTriangle,
  Share2,
  CheckCircle2,
  Pencil,
  Info,
  Upload,
  Loader2,
  BarChart3,
  Link as LinkIcon,
  Eye,
  EyeOff,
  KeyRound,
  Printer,
  FileText,
  Send,
  Play,
  Package,
  PackageCheck,
  XCircle,
  Plus,
} from "lucide-react"
import { PHOTO_TYPES, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { formatDate } from "@/lib/utils-client"
import { kurusToLira, bpsToPercent, liraToKurus, percentToBps } from "@/lib/money"
import { ServiceAdvisorPanel } from "@/components/app/service-advisor-panel"
import { AdvisorPremiumLock } from "@/components/app/advisor-premium-lock"
import { PhotoAnnotate } from "./photo-annotate"
import { PhotoGalleryGrid } from "./photo-gallery-grid"
import { generateWhatsAppShareText, getWhatsAppSendUrl } from "@/lib/share/whatsapp"
import { calculatePhotoCompletion } from "@/lib/intake/completeness"
import { IntakeEvidenceSummary } from "@/components/app/intake-evidence-summary"
import { ApprovalTimeline } from "@/components/app/approval-timeline"
import {
  NEXT_STATUSES,
  PartsLaborCard,
  PricingSummaryCard,
  PaymentHistoryCard,
  OrderInfoCard,
  type OrderDetailData,
  type PricingMetaDraft,
} from "@/components/app/order-management-panel"

const PHOTO_PHASE_LABELS: Record<string, string> = {
  intake: "Kabul (Intake)",
  repair_progress: "Onarım Aşaması",
  delivery: "Teslim",
}

// Header aksiyon ikonları (eski orders ekranıyla aynı görünüm).
const ORDER_ACTION_ICONS: Record<string, DetailHeaderAction["icon"]> = {
  waiting_approval: Send,
  approved: CheckCircle2,
  in_progress: Play,
  waiting_parts: Package,
  ready_for_delivery: PackageCheck,
  delivered: KeyRound,
  cancelled: XCircle,
}

type VehiclePhoto = {
  id: string
  type: string
  phase: string
  label: string
  required: boolean
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  storageProvider: string | null
  note: string | null
}

type IntakeDetailProps = {
  id: string
  status: string
  mileageAtIntake: number | null
  customerComplaint: string
  internalNote: string | null
  approvedAt: Date | null
  createdAt: Date
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
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
  photos: VehiclePhoto[]
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  approvals: { id: string; status: string; otpCode: string; createdAt: Date }[]
  shareLinks: { id: string; token: string; isActive: boolean }[]
  timelineEvents: { eventType: string; description: string; createdAt: Date }[]
  order: { id: string; status: string; paymentStatus: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
}

export function WorkOrderDetail({
  intake,
  order,
  technicians,
  hasAiAdvisor,
}: {
  intake: IntakeDetailProps
  order: OrderDetailData
  technicians?: { id: string; fullName: string; role: string }[]
  hasAiAdvisor: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Order-side pricing/meta edit
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaDraft, setMetaDraft] = useState<PricingMetaDraft>({
    technicianName: order.technicianName || "",
    estimatedDeliveryAt: order.estimatedDeliveryAt
      ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16)
      : "",
    discountAmount: order.discountAmount != null ? String(kurusToLira(order.discountAmount)) : "",
    taxRate: order.taxRate != null ? String(bpsToPercent(order.taxRate)) : "",
    notes: order.notes || "",
  })

  // Intake info edit (complaint/note/mileage)
  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [editComplaint, setEditComplaint] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editMileage, setEditMileage] = useState("")

  // Photos
  const photosRef = useRef<HTMLDivElement>(null)
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [photoType, setPhotoType] = useState("")
  const [photoPhase, setPhotoPhase] = useState("intake")
  const [photoNote, setPhotoNote] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Share
  const [shareToken, setShareToken] = useState(intake.shareLinks[0]?.token || "")

  // Delivery OTP
  const [deliveryOtpMode, setDeliveryOtpMode] = useState(false)
  const [deliveryOtpCode, setDeliveryOtpCode] = useState("")
  const [deliverySentCode, setDeliverySentCode] = useState<string | null>(null)

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
      if (data.success) router.refresh()
      else setError(data.error || "Durum güncellenemedi")
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
      formData.set("discountAmount", String(liraToKurus(Math.max(0, Number(metaDraft.discountAmount) || 0))))
      formData.set("taxRate", String(percentToBps(Number(metaDraft.taxRate) || 0)))
      formData.set("notes", metaDraft.notes)
      const res = await fetch(`/api/orders/${order.id}/meta`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setEditingMeta(false)
        router.refresh()
      } else setError(data.error || "Bilgiler güncellenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  function startEditInfo() {
    setEditComplaint(order.intake.customerComplaint)
    setEditNote(order.intake.internalNote ?? "")
    setEditMileage(order.intake.mileageAtIntake != null ? String(order.intake.mileageAtIntake) : "")
    setError("")
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    setSavingInfo(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerComplaint: editComplaint, internalNote: editNote, mileageAtIntake: editMileage }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingInfo(false)
        router.refresh()
      } else setError(data.error || "Bilgiler güncellenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleAddPhoto() {
    if (!photoType) return
    setLoading(true)
    setError("")
    const formData = new FormData()
    formData.set("intakeFormId", intake.id)
    formData.set("type", photoType)
    formData.set("label", PHOTO_TYPES[photoType as keyof typeof PHOTO_TYPES]?.label || photoType)
    if (photoNote) formData.set("note", photoNote)
    if (photoPhase) formData.set("phase", photoPhase)
    if (photoFile) formData.set("file", photoFile)
    try {
      const res = await fetch("/api/intakes/photos", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setAddingPhoto(false)
        setPhotoType("")
        setPhotoPhase("intake")
        setPhotoNote("")
        setPhotoFile(null)
        setPhotoPreview(null)
        if (photoInputRef.current) photoInputRef.current.value = ""
        router.refresh()
      } else setError(data.error || "Fotoğraf eklenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateShareLink() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/share`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setShareToken(data.token)
        router.refresh()
      } else setError(data.error || "Link oluşturulamadı")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestDeliveryOtp() {
    setLoading(true); setError(""); setDeliverySentCode(null)
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp`, { method: "POST" })
      const data = await res.json() as { success?: boolean; otpCode?: string; error?: string }
      if (data.success) {
        setDeliveryOtpMode(true)
        setDeliverySentCode(data.otpCode ?? null)
      } else setError(data.error || "Kod gönderilemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyDeliveryOtp() {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: deliveryOtpCode }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) router.refresh()
      else setError(data.error || "Doğrulama başarısız")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  // AI danışman önerilerini iş emrine kalem olarak ekle.
  async function handleAddAiItems(items: Array<{ type: "labor" | "part"; name: string }>) {
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
        if (!data.success) { setError(data.error || "Kalem eklenemedi"); break }
      }
      router.refresh()
    } catch {
      setError("AI önerileri eklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const customerName =
    order.customer.type === "corporate"
      ? order.customer.companyName || "Kurumsal Müşteri"
      : order.customer.fullName ||
        `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() ||
        "Müşteri"

  // Header aksiyonları eski orders akışı (order durum makinesi). Teslim adımı
  // OTP akışını tetikler (müşteri onaylı teslim); verify hem intake hem order'ı
  // delivered yapar.
  const nextActions = NEXT_STATUSES[order.status] || []
  const headerActions: DetailHeaderAction[] = nextActions.map((a) => ({
    key: a.key,
    label: a.key === "delivered" ? "Teslim Et (OTP)" : a.label,
    onClick: a.key === "delivered" ? handleRequestDeliveryOtp : () => changeStatus(a.key),
    tone: a.key === "cancelled" ? "danger" : a.primary ? "primary" : "secondary",
    icon: ORDER_ACTION_ICONS[a.key],
  }))

  const damagePhotos = intake.photos.filter((p) => p.type === "damage_detail")
  const takenPhotoTypes = new Set(intake.photos.map((p) => p.type))
  const missingRequired = Object.entries(PHOTO_TYPES).filter(([key, v]) => v.required && !takenPhotoTypes.has(key))
  const photoCompletion = calculatePhotoCompletion(intake.photos.map((p) => p.type))
  const approvalStatus = intake.approvals.length > 0
    ? intake.approvals[0].status === "verified" ? "verified" as const : "pending" as const
    : "none" as const
  const publicLinkStatus = intake.shareLinks.length > 0
    ? intake.shareLinks[0].isActive ? "active" as const : "expired" as const
    : "none" as const

  const shareLinkFull = shareToken
    ? (typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`)
    : null

  function focusPhoto(typeKey?: string) {
    if (typeKey) setPhotoType(typeKey)
    setAddingPhoto(true)
    photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
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

      {deliveryOtpMode && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><KeyRound className="size-4" /> Teslim Onayı (OTP)</p>
          {order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning">Uyarı: Bu iş emrinde ödeme tamamlanmadı ({order.paymentStatus}).</p>
          )}
          {deliverySentCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Demo kodu (SMS kapalı): <span className="font-mono font-bold">{deliverySentCode}</span></p>
              <button
                type="button"
                onClick={() => {
                  const text = `BakimX teslim onay kodunuz: ${deliverySentCode}. Aracınızın teslimini onaylamak için bu kodu servise iletin.`
                  window.open(getWhatsAppSendUrl(order.customer.phone, text), "_blank")
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
              >
                WhatsApp ile Gönder
              </button>
            </div>
          )}
          <Input
            value={deliveryOtpCode}
            onChange={(e) => setDeliveryOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 haneli teslim kodu"
            inputMode="numeric"
            className="text-center text-xl tracking-widest"
          />
          <div className="flex gap-2">
            <Button onClick={handleVerifyDeliveryOtp} disabled={loading || deliveryOtpCode.length < 6} size="lg" className="flex-1">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Doğrula ve Teslim Et"}
            </Button>
            <Button variant="outline" onClick={handleRequestDeliveryOtp} disabled={loading} size="lg">Kodu Tekrar Gönder</Button>
            <Button variant="ghost" onClick={() => { setDeliveryOtpMode(false); setDeliveryOtpCode(""); setDeliverySentCode(null) }} disabled={loading} size="lg">Vazgeç</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* MAIN */}
        <div className="lg:col-span-2 space-y-5">
          {/* Müşteri & Araç */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Müşteri & Araç</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="size-3" /> Müşteri
                  </div>
                  <p className="text-sm font-semibold text-foreground">{customerName}</p>
                  {order.customer.type === "corporate" && order.customer.contactName ? (
                    <p className="text-xs text-muted-foreground">Yetkili: {order.customer.contactName}</p>
                  ) : null}
                  <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <Phone className="size-3.5" />
                    {order.customer.phone}
                  </a>
                  {order.customer.email && (
                    <a href={`mailto:${order.customer.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                      <Mail className="size-3.5" />
                      {order.customer.email}
                    </a>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Car className="size-3" /> Araç
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {order.vehicle.plate} · {order.vehicle.brand} {order.vehicle.model}
                    {order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {order.intake.mileageAtIntake != null && <span>Giriş KM: {order.intake.mileageAtIntake.toLocaleString("tr-TR")}</span>}
                    {order.vehicle.mileage != null && <span>Kayıtlı: {order.vehicle.mileage.toLocaleString("tr-TR")} km</span>}
                    {order.vehicle.vin && <span className="font-mono">VIN: {order.vehicle.vin}</span>}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Kabul: {formatDate(order.intake.createdAt)}</span>
                {order.intake.approvedAt && <span>Onay: {formatDate(order.intake.approvedAt)}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Şikayet & Notlar (düzenlenebilir) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><ClipboardList className="size-4" /> Şikayet & Notlar</span>
                {!editingInfo && (
                  <button
                    onClick={startEditInfo}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 px-2 py-1 rounded-lg touch-manipulation"
                  >
                    <Pencil className="size-3.5" /> Düzenle
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingInfo ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <Label>Müşteri Şikayeti</Label>
                    <Textarea value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} placeholder="Müşterinin bildirdiği arıza/şikayet..." className="min-h-[80px]" />
                  </div>
                  <div>
                    <Label>Teknisyen İç Notu</Label>
                    <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-[60px]" />
                  </div>
                  <div>
                    <Label>Kilometre (kabul anı)</Label>
                    <Input type="number" inputMode="numeric" min="0" value={editMileage} onChange={(e) => setEditMileage(e.target.value)} placeholder="Örn. 125000" />
                  </div>
                  <p className="text-xs text-muted-foreground">Yapılan değişiklik zaman çizelgesine ve denetim kaydına işlenir.</p>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSaveInfo} disabled={savingInfo || !editComplaint.trim()} size="sm" className="flex-1">
                      {savingInfo ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingInfo(false)} disabled={savingInfo} size="sm">İptal</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Müşteri Şikayeti</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.customerComplaint}</p>
                  </div>
                  {order.intake.internalNote && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Teknisyen İç Notu</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.internalNote}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground italic">Bu not müşteri çıktısında gösterilmez</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parça & İşçilik */}
          <PartsLaborCard orderId={order.id} items={order.items} onError={setError} onLoading={setLoading} loading={loading} />

          {/* AI Danışman */}
          {hasAiAdvisor ? (
            <ServiceAdvisorPanel
              intakeFormId={intake.id}
              customerComplaint={order.intake.customerComplaint}
              vehicleBrand={order.vehicle.brand}
              vehicleModel={order.vehicle.model}
              mileage={order.intake.mileageAtIntake ?? order.vehicle.mileage}
              onAddItems={handleAddAiItems}
            />
          ) : (
            <AdvisorPremiumLock />
          )}

          {/* Özet & Kanıt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="size-4" /> Özet & Kanıt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <IntakeEvidenceSummary
                photoCompletion={photoCompletion}
                damageCount={damagePhotos.length}
                approvalStatus={approvalStatus}
                publicLinkStatus={publicLinkStatus}
                onMissingPhotoClick={(key) => focusPhoto(key)}
              />
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Onay Zaman Çizelgesi</p>
                <ApprovalTimeline events={intake.timelineEvents || []} intakeCreatedAt={intake.createdAt} approvedAt={intake.approvedAt} />
              </div>
            </CardContent>
          </Card>

          {/* Fotoğraflar */}
          <div ref={photosRef} className="scroll-mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Camera className="size-4" /> Fotoğraflar</span>
                <span className="text-sm font-normal text-muted-foreground">{takenPhotoTypes.size} / {Object.entries(PHOTO_TYPES).length} tamamlandı</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Gallery */}
              {intake.photos.length > 0 ? (
                <PhotoGalleryGrid photos={intake.photos} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">Henüz fotoğraf eklenmedi</p>
              )}

              {/* Missing required chips */}
              {missingRequired.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Eksik:</span>
                  {missingRequired.map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => focusPhoto(key)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors touch-manipulation"
                    >
                      <Camera className="size-3" /> {val.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-success flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Tüm zorunlu fotoğraflar tamam</p>
              )}

              {/* Add photo trigger + dialog */}
              <Button variant="outline" size="sm" onClick={() => setAddingPhoto(true)} className="w-full">
                <Plus className="size-3.5 mr-1" /> Fotoğraf Ekle
              </Button>

              <Dialog
                open={addingPhoto}
                onOpenChange={(o) => {
                  setAddingPhoto(o)
                  if (!o) { setPhotoType(""); setPhotoNote(""); setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = "" }
                }}
              >
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Camera className="size-4 text-primary" /> Fotoğraf Ekle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Fotoğraf Türü</Label>
                  <Select value={photoType} onValueChange={(v) => { setPhotoType(v ?? ""); setPhotoFile(null); setPhotoPreview(null) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seçiniz...">
                        {(value: string | null) => {
                          if (!value) return null
                          const val = PHOTO_TYPES[value as keyof typeof PHOTO_TYPES]
                          if (!val) return value
                          return `${val.label} ${val.required ? "(Zorunlu)" : "(Opsiyonel)"}`
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Seçiniz...</SelectItem>
                      {Object.entries(PHOTO_TYPES).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label} {val.required ? "(Zorunlu)" : "(Opsiyonel)"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Aşama</Label>
                  <Select value={photoPhase} onValueChange={(v) => setPhotoPhase(v ?? "intake")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Aşama seçin">
                        {(value: string | null) => (value ? PHOTO_PHASE_LABELS[value] ?? value : null)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Kabul (Intake)</SelectItem>
                      <SelectItem value="repair_progress">Onarım Aşaması</SelectItem>
                      <SelectItem value="delivery">Teslim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fotoğraf Çek / Yükle</Label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setPhotoFile(file)
                      setPhotoPreview(URL.createObjectURL(file))
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                  >
                    <Camera className="size-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{photoFile ? "Fotoğraf seçildi — tekrar değiştir" : "Kamera ile çek veya galeriden seç"}</span>
                  </button>
                  {photoPreview && (
                    <div className="relative mt-2 rounded-lg overflow-hidden border bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Seçilen fotoğraf önizlemesi" className="w-full max-h-48 object-contain" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = "" }}
                        className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full"
                      >
                        Kaldır
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Not</Label>
                  <Input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Fotoğraf açıklaması..." />
                </div>
                <Button onClick={handleAddPhoto} disabled={loading || !photoType} size="lg" className="w-full">
                  {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                  {photoFile ? "Fotoğraf Yükle ve Kaydet" : "Fotoğraf Kaydı Ekle"}
                </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          </div>

          {/* Hasar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Hasar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoAnnotate intakeFormId={intake.id} onUploaded={() => router.refresh()} />

              {intake.damageMarks.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Hasar İşaretleri ({intake.damageMarks.length})</p>
                  <div className="space-y-1.5">
                    {intake.damageMarks.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2.5 bg-muted rounded-lg text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (DAMAGE_SEVERITY as Record<string, { color: string }>)[d.severity]?.color || "#9CA3AF" }} />
                          <span className="font-medium truncate">{VEHICLE_ZONES[d.zone as keyof typeof VEHICLE_ZONES] || d.zone}</span>
                          <span className="text-muted-foreground text-xs shrink-0">{DAMAGE_TYPES[d.damageType as keyof typeof DAMAGE_TYPES]?.label || d.damageType}</span>
                        </div>
                        {d.note && <span className="text-xs text-muted-foreground truncate max-w-[40%]">- {d.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {damagePhotos.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Hasar Fotoğrafları ({damagePhotos.length})</p>
                  <PhotoGalleryGrid photos={damagePhotos} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-5">
          <PricingSummaryCard
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
            customerName={customerName}
          />

          <OrderInfoCard order={order} technicians={technicians} />

          {/* Müşteri Çıktısı & Paylaşım */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Share2 className="size-4 text-muted-foreground" /> Müşteri Çıktısı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!shareToken ? (
                <>
                  <p className="text-xs text-muted-foreground">Müşteriyle paylaşabileceğiniz salt-görüntü bir özet linki oluşturun.</p>
                  <Button onClick={handleGenerateShareLink} disabled={loading} size="sm" className="w-full">
                    <Share2 className="size-4 mr-2" /> Müşteri Çıktı Linki Oluştur
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    {intake.shareLinks[0]?.isActive ? <Eye className="size-3.5 text-success" /> : <EyeOff className="size-3.5 text-destructive" />}
                    <span className={intake.shareLinks[0]?.isActive ? "text-success font-medium" : "text-destructive font-medium"}>
                      {intake.shareLinks[0]?.isActive ? "Link aktif" : "Link devre dışı"}
                    </span>
                  </div>
                  <Link href={`/s/${shareToken}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation">
                    <FileText className="size-4 text-muted-foreground" /> Müşteri Çıktısını Aç
                  </Link>
                  <Link href={`/s/${shareToken}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation">
                    <Printer className="size-4 text-muted-foreground" /> Yazdır / PDF
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (!shareLinkFull) return
                      const text = generateWhatsAppShareText({ publicLink: shareLinkFull, totalAmount: order.totals.hasAnyPrice ? order.totals.grandTotal : null })
                      window.open(getWhatsAppSendUrl(order.customer.phone, text), "_blank")
                    }}
                    className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-[#25D366] hover:bg-[#25D366]/90 text-white text-sm font-medium transition-colors touch-manipulation"
                  >
                    <Share2 className="size-4" /> WhatsApp ile Paylaş
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const linkId = intake.shareLinks[0]?.id
                        if (!linkId) return
                        try {
                          await fetch(`/api/intakes/${intake.id}/share-visibility`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ linkId, isActive: !intake.shareLinks[0].isActive }),
                          })
                          router.refresh()
                        } catch {}
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border bg-background text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      {intake.shareLinks[0]?.isActive ? <><EyeOff className="size-3.5" /> Devre Dışı</> : <><Eye className="size-3.5" /> Etkinleştir</>}
                    </button>
                    <button
                      type="button"
                      onClick={async () => { if (shareLinkFull) { try { await navigator.clipboard.writeText(shareLinkFull) } catch {} } }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border bg-background text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <LinkIcon className="size-3.5" /> Kopyala
                    </button>
                  </div>
                </>
              )}

              {order.status === "ready_for_delivery" && !deliveryOtpMode && (
                <div className="pt-3 border-t">
                  <Button onClick={handleRequestDeliveryOtp} disabled={loading} size="sm" variant="outline" className="w-full">
                    <KeyRound className="size-4 mr-2" /> Teslim Onayı (OTP) Gönder
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
