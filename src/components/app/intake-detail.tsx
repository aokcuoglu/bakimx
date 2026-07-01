"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlateBadge } from "@/components/app/plate-badge"
import {
  Car,
  User,
  Phone,
  ClipboardList,
  Camera,
  AlertTriangle,
  Share2,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Info,
  Wrench,
  Upload,
  Loader2,
  BarChart3,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Play,
  PackageCheck,
  KeyRound,
  XCircle,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { INTAKE_STATUS, PHOTO_TYPES } from "@/lib/constants"
import { ServiceAdvisorPanel } from "@/components/app/service-advisor-panel"
import { AdvisorPremiumLock } from "@/components/app/advisor-premium-lock"
import { PhotoAnnotate } from "./photo-annotate"
import { PhotoGalleryGrid } from "./photo-gallery-grid"
import { formatTRY } from "@/lib/format"
import { liraToKurus } from "@/lib/money"
import { generateWhatsAppShareText, getWhatsAppSendUrl } from "@/lib/share/whatsapp"
import { calculatePhotoCompletion, groupPhotosByPhase } from "@/lib/intake/completeness"
import { IntakeEvidenceSummary } from "@/components/app/intake-evidence-summary"
import { ApprovalTimeline } from "@/components/app/approval-timeline"

const PHOTO_PHASE_LABELS: Record<string, string> = {
  intake: "Kabul (Intake)",
  repair_progress: "Onarım Aşaması",
  delivery: "Teslim",
}

const ORDER_ITEM_TYPE_LABELS: Record<string, string> = {
  part: "Parça",
  labor: "İşçilik",
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

export function IntakeDetail({ intake, hasAiAdvisor }: { intake: IntakeDetailProps; hasAiAdvisor: boolean }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"info" | "photos" | "damage" | "share" | "order" | "evidence">("info")
  const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]

  const [shareToken, setShareToken] = useState(intake.shareLinks[0]?.token || "")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [photoType, setPhotoType] = useState("")
  const [photoPhase, setPhotoPhase] = useState("intake")
  const [photoNote, setPhotoNote] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [deliveryOtpMode, setDeliveryOtpMode] = useState(false)
  const [deliveryOtpCode, setDeliveryOtpCode] = useState("")
  const [deliverySentCode, setDeliverySentCode] = useState<string | null>(null)

  const [showOrderItemForm, setShowOrderItemForm] = useState(false)
  const [itemType, setItemType] = useState("part")
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")

  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [editComplaint, setEditComplaint] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editMileage, setEditMileage] = useState("")

  function startEditInfo() {
    setEditComplaint(intake.customerComplaint)
    setEditNote(intake.internalNote ?? "")
    setEditMileage(intake.mileageAtIntake != null ? String(intake.mileageAtIntake) : "")
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
        body: JSON.stringify({
          customerComplaint: editComplaint,
          internalNote: editNote,
          mileageAtIntake: editMileage,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingInfo(false)
        router.refresh()
      } else {
        setError(data.error || "Bilgiler güncellenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/status`, {
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

  async function handleRequestDeliveryOtp() {
    setLoading(true); setError(""); setDeliverySentCode(null)
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp`, { method: "POST" })
      const data = await res.json() as { success?: boolean; otpCode?: string; error?: string }
      if (data.success) {
        setDeliveryOtpMode(true)
        setDeliverySentCode(data.otpCode ?? null)
      } else {
        setError(data.error || "Kod gönderilemedi")
      }
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
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Doğrulama başarısız")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
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
        setPhotoType("")
        setPhotoPhase("intake")
        setPhotoNote("")
        setPhotoFile(null)
        setPhotoPreview(null)
        if (photoInputRef.current) photoInputRef.current.value = ""
        router.refresh()
      } else {
        setError(data.error || "Fotoğraf eklenemedi")
      }
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
      } else {
        setError(data.error || "Link oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrder() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeFormId: intake.id }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Servis emri oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddOrderItem() {
    setLoading(true)
    setError("")
    if (!intake.order) return
    const formData = new FormData()
    formData.set("serviceOrderId", intake.order.id)
    formData.set("type", itemType)
    formData.set("name", itemName)
    formData.set("quantity", itemQty)
    if (itemPrice) formData.set("unitPrice", String(liraToKurus(Number(itemPrice))))

    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setShowOrderItemForm(false)
        setItemName("")
        setItemQty("1")
        setItemPrice("")
        router.refresh()
      } else {
        setError(data.error || "Kalem eklenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const requiredPhotos = Object.entries(PHOTO_TYPES).filter(([, v]) => v.required)
  const takenPhotoTypes = new Set(intake.photos.map((p) => p.type))
  const photoCompletion = calculatePhotoCompletion(intake.photos.map((p) => p.type))
  const photoGroups = groupPhotosByPhase(intake.photos)

  const timelineEvents = intake.timelineEvents || []
  const approvalStatus = intake.approvals.length > 0
    ? intake.approvals[0].status === "verified" ? "verified" as const : "pending" as const
    : "none" as const
  const publicLinkStatus = intake.shareLinks.length > 0
    ? intake.shareLinks[0].isActive ? "active" as const : "expired" as const
    : "none" as const

  // Forward (positive) status actions — one primary + optional secondary, driven by status.
  type ForwardAction = {
    key: string
    label: string
    icon: typeof Play
    onClick: () => void
    tone: "primary" | "secondary"
  }
  const forwardActions: ForwardAction[] = []
  if (intake.status === "draft") {
    forwardActions.push({ key: "start", label: "İşleme Başla", icon: Play, onClick: () => handleStatusChange("in_progress"), tone: "primary" })
  }
  if (intake.status === "approved" && !intake.order) {
    forwardActions.push({ key: "create-order", label: "Servis Emri Oluştur", icon: Wrench, onClick: handleCreateOrder, tone: "primary" })
  }
  if (intake.status === "approved") {
    forwardActions.push({ key: "start", label: "İşleme Başla", icon: Play, onClick: () => handleStatusChange("in_progress"), tone: intake.order ? "primary" : "secondary" })
  }
  if (intake.status === "in_progress") {
    forwardActions.push({ key: "ready", label: "Teslimata Hazır", icon: PackageCheck, onClick: () => handleStatusChange("ready_for_delivery"), tone: "primary" })
  }
  if (intake.status === "ready_for_delivery" && !deliveryOtpMode) {
    forwardActions.push({ key: "deliver", label: "Teslim Et (OTP)", icon: KeyRound, onClick: handleRequestDeliveryOtp, tone: "primary" })
  }
  if (intake.status === "cancelled") {
    forwardActions.push({ key: "reactivate", label: "Yeniden Aktif Et", icon: RotateCcw, onClick: () => handleStatusChange("draft"), tone: "primary" })
  }
  const canCancel = intake.status === "draft" || intake.status === "in_progress" || intake.status === "waiting_approval"
  const hasActions = forwardActions.length > 0 || canCancel

  // Shared renderers so the desktop (header) and mobile (sticky bar) share one source of truth.
  const renderForwardButtons = (opts: { size: "default" | "lg"; stretch?: boolean }) =>
    forwardActions.map((a) => {
      const Icon = a.icon
      return (
        <Button
          key={a.key}
          size={opts.size}
          variant={a.tone === "primary" ? "default" : "outline"}
          onClick={a.onClick}
          disabled={loading}
          className={opts.stretch ? "flex-1" : undefined}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
          {a.label}
        </Button>
      )
    })

  const renderCancelButton = (opts: { size: "default" | "lg" }) =>
    canCancel ? (
      <Button
        size={opts.size}
        variant="ghost"
        onClick={() => handleStatusChange("cancelled")}
        disabled={loading}
        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <XCircle className="size-4" />
        İptal Et
      </Button>
    ) : null

  const tabs = [
    { id: "info" as const, label: "Bilgiler", icon: ClipboardList },
    { id: "evidence" as const, label: "Özet", icon: BarChart3 },
    { id: "photos" as const, label: "Fotoğraflar", icon: Camera },
    { id: "damage" as const, label: "Hasar", icon: AlertTriangle, count: intake.photos.filter((p) => p.type === "damage_detail").length },
    { id: "share" as const, label: "Paylaşım", icon: Share2 },
    { id: "order" as const, label: "Sipariş", icon: Wrench },
  ]

  return (
    <div className={cn("space-y-6", hasActions && "pb-24 lg:pb-0")}>
      {/* Header */}
      <div className="flex items-start gap-3 sm:items-center">
        <button onClick={() => router.push("/intakes")} className="p-2.5 hover:bg-muted rounded-lg touch-manipulation shrink-0">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex flex-col items-start gap-1 min-w-0 sm:flex-row sm:items-center sm:flex-wrap sm:gap-2">
            <PlateBadge plate={intake.vehicle.plate} />
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <span className="inline-flex items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <Car className="size-3.5 shrink-0" />
              <span className="truncate">{intake.vehicle.brand} {intake.vehicle.model}</span>
            </span>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <span className="inline-flex items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">
                {intake.customer.type === "corporate"
                  ? intake.customer.companyName || "Kurumsal Müşteri"
                  : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={cn("h-8 px-3 text-sm", statusInfo?.color || "bg-muted text-foreground")}>
              {statusInfo?.label || intake.status}
            </Badge>
            {/* Desktop actions live in the header; mobile uses the sticky bar below */}
            {hasActions && (
              <div className="hidden lg:flex items-center gap-2">
                {renderCancelButton({ size: "default" })}
                {renderForwardButtons({ size: "default" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-foreground text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Mobile sticky action bar — sits above the bottom nav (bottom-16) */}
      {hasActions && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border px-4 py-3 safe-area-bottom flex items-center gap-2">
          {renderCancelButton({ size: "lg" })}
          {forwardActions.length > 0
            ? renderForwardButtons({ size: "lg", stretch: true })
            : <span className="flex-1" />}
        </div>
      )}

      {intake.status === "ready_for_delivery" && deliveryOtpMode && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium">Teslim Onayı (OTP)</p>
          {intake.order && intake.order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning">Uyarı: Bu iş emrinde ödeme tamamlanmadı ({intake.order.paymentStatus}).</p>
          )}
          {deliverySentCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Demo kodu (SMS kapalı): <span className="font-mono font-bold">{deliverySentCode}</span></p>
              <button
                type="button"
                onClick={() => {
                  const text = `BakimX teslim onay kodunuz: ${deliverySentCode}. Aracınızın teslimini onaylamak için bu kodu servise iletin.`
                  window.open(getWhatsAppSendUrl(intake.customer.phone, text), "_blank")
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList variant="line" className="w-full max-w-full flex-nowrap border-b gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="shrink-0 px-3 py-2.5">
                <Icon className="size-4" />
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      <TabsContent value="info">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="size-4" /> Müşteri Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {intake.customer.type === "corporate"
                    ? intake.customer.companyName || "Kurumsal Müşteri"
                    : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
                </div>
                {intake.customer.type === "corporate" && intake.customer.contactName ? (
                  <div className="text-xs text-muted-foreground">Yetkili: {intake.customer.contactName}</div>
                ) : null}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5" />
                  {intake.customer.phone}
                </div>
                {intake.customer.email && <div className="text-muted-foreground">{intake.customer.email}</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Car className="size-4" /> Araç Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="font-medium">{intake.vehicle.plate} - {intake.vehicle.brand} {intake.vehicle.model}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {intake.vehicle.modelYear && <span>Model: {intake.vehicle.modelYear}</span>}
                  {intake.mileageAtIntake && <span>Kilometre: {intake.mileageAtIntake.toLocaleString("tr-TR")} km</span>}
                  {intake.vehicle.vin && <span className="font-mono text-xs">VIN: {intake.vehicle.vin}</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><ClipboardList className="size-4" /> Kabul Bilgileri</span>
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
                    <Textarea
                      value={editComplaint}
                      onChange={(e) => setEditComplaint(e.target.value)}
                      placeholder="Müşterinin bildirdiği arıza/şikayet..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div>
                    <Label>İç Not</Label>
                    <Textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Servis içi notlar (opsiyonel)..."
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label>Kilometre (kabul anı)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={editMileage}
                      onChange={(e) => setEditMileage(e.target.value)}
                      placeholder="Örn. 125000"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Yapılan değişiklik zaman çizelgesine ve denetim kaydına işlenir.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSaveInfo} disabled={savingInfo || !editComplaint.trim()} size="sm" className="flex-1">
                      {savingInfo ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingInfo(false)} disabled={savingInfo} size="sm">
                      İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Müşteri Şikayeti:</span>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{intake.customerComplaint}</p>
                  </div>
                  {intake.internalNote && (
                    <div>
                      <span className="font-medium">İç Not:</span>
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{intake.internalNote}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Oluşturulma: {new Date(intake.createdAt).toLocaleDateString("tr-TR")}
                    {intake.approvedAt && <> • Onay: {new Date(intake.approvedAt).toLocaleDateString("tr-TR")}</>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {hasAiAdvisor ? (
            <ServiceAdvisorPanel
              intakeFormId={intake.id}
              customerComplaint={intake.customerComplaint}
              vehicleBrand={intake.vehicle.brand}
              vehicleModel={intake.vehicle.model}
              mileage={intake.mileageAtIntake ?? intake.vehicle.mileage}
              onAddItems={async () => {
                router.refresh()
              }}
            />
          ) : (
            <AdvisorPremiumLock />
          )}
        </div>
      </TabsContent>

      <TabsContent value="evidence">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4" />
                Kabul Durum Paneli
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IntakeEvidenceSummary
                photoCompletion={photoCompletion}
                damageCount={intake.photos.filter((p) => p.type === "damage_detail").length}
                approvalStatus={approvalStatus}
                publicLinkStatus={publicLinkStatus}
                onMissingPhotoClick={(key) => {
                  setPhotoType(key)
                  setActiveTab("photos")
                }}
              />
            </CardContent>
          </Card>

          {photoGroups.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="size-4" />
                  Fotoğraf Grupları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {photoGroups.map((group) => {
                  const groupPhotos = intake.photos.filter((p) => (p.phase || "intake") === group.phase)
                  return (
                    <div key={group.phase} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {groupPhotos.length}
                        </span>
                      </div>
                      {groupPhotos.length > 0 ? (
                        <PhotoGalleryGrid photos={groupPhotos} gridClassName="grid grid-cols-3 gap-2" />
                      ) : (
                        <p className="text-xs text-muted-foreground py-2">Bu aşamada fotoğraf yok</p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Onay Zaman Çizelgesi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalTimeline
                events={timelineEvents}
                intakeCreatedAt={intake.createdAt}
                approvedAt={intake.approvedAt}
              />
            </CardContent>
          </Card>

          {intake.shareLinks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <LinkIcon className="size-4" />
                  Halka Açık Link Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {intake.shareLinks[0].isActive ? (
                    <Eye className="size-4 text-success" />
                  ) : (
                    <EyeOff className="size-4 text-destructive" />
                  )}
                  <span className={intake.shareLinks[0].isActive ? "text-success font-medium" : "text-destructive font-medium"}>
                    {intake.shareLinks[0].isActive ? "Link aktif" : "Link devre dışı"}
                  </span>
                </div>
                <div className="bg-muted rounded-lg p-3 text-sm break-all">
                  <a
                    href={`/s/${intake.shareLinks[0].token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {typeof window !== "undefined" ? `${window.location.origin}/s/${intake.shareLinks[0].token}` : `/s/${intake.shareLinks[0].token}`}
                  </a>
                </div>
                <div className="flex gap-2">
                  <button
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
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {intake.shareLinks[0].isActive ? (
                      <>
                        <EyeOff className="size-4" />
                        Devre Dışı Bırak
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" />
                        Etkinleştir
                      </>
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      const publicLink = typeof window !== "undefined" ? `${window.location.origin}/s/${intake.shareLinks[0].token}` : `/s/${intake.shareLinks[0].token}`
                      try { await navigator.clipboard.writeText(publicLink) } catch {}
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Linki Kopyala
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="photos">
        <div className="space-y-4">
          {/* Required photo checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Fotoğraf Kontrol Listesi</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {takenPhotoTypes.size} / {Object.entries(PHOTO_TYPES).length} fotoğraf tamamlandı
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Zorunlu Fotoğraflar</p>
                {requiredPhotos.map(([key, val]) => {
                  const taken = takenPhotoTypes.has(key)
                  return (
                    <PhotoChecklistItem
                      key={key}
                      photoKey={key}
                      label={val.label}
                      taken={taken}
                      required={true}
                      intakeId={intake.id}
                    />
                  )
                })}
                <p className="text-xs font-medium text-muted-foreground mb-1 pt-2">Opsiyonel Fotoğraflar</p>
                {Object.entries(PHOTO_TYPES)
                  .filter(([, v]) => !v.required)
                  .map(([key, val]) => {
                    const taken = takenPhotoTypes.has(key)
                    return (
                      <PhotoChecklistItem
                        key={key}
                        photoKey={key}
                        label={val.label}
                        taken={taken}
                        required={false}
                        intakeId={intake.id}
                      />
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Add photo */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Fotoğraf Ekle</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Fotoğraf Türü</Label>
                <Select
                  value={photoType}
                  onValueChange={(v) => {
                    setPhotoType(v ?? "")
                    setPhotoFile(null)
                    setPhotoPreview(null)
                  }}
                >
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
                      <SelectItem key={key} value={key}>
                        {val.label} {val.required ? "(Zorunlu)" : "(Opsiyonel)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aşama</Label>
                <Select
                  value={photoPhase}
                  onValueChange={(v) => setPhotoPhase(v ?? "intake")}
                >
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
              <div>
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
                    const url = URL.createObjectURL(file)
                    setPhotoPreview(url)
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                >
                  <Camera className="size-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {photoFile ? "Fotoğraf seçildi — tekrar değiştir" : "Kamera ile çek veya galeriden seç"}
                  </span>
                </button>
                {photoPreview && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Seçilen fotoğraf önizlemesi"
                      className="w-full max-h-48 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null)
                        setPhotoPreview(null)
                        if (photoInputRef.current) photoInputRef.current.value = ""
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full"
                    >
                      Kaldır
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  İzin verilen formatlar: JPEG, PNG, WebP. Maksimum 8 MB.
                </p>
              </div>
              <div>
                <Label>Not</Label>
                <Input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Fotoğraf açıklaması..." />
              </div>
              <Button onClick={handleAddPhoto} disabled={loading || !photoType} size="lg" className="w-full">
                {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                {photoFile ? "Fotoğraf Yükle ve Kaydet" : "Fotoğraf Kaydı Ekle"}
              </Button>
            </CardContent>
          </Card>

          {/* Media gallery */}
          {intake.photos.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Kaydedilmiş Fotoğraflar ({intake.photos.length})</CardTitle></CardHeader>
              <CardContent>
                <PhotoGalleryGrid photos={intake.photos} />
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="damage">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Hasar Fotoğrafı Ekle</CardTitle></CardHeader>
            <CardContent>
              <PhotoAnnotate intakeFormId={intake.id} onUploaded={() => router.refresh()} />
            </CardContent>
          </Card>

          {intake.photos.filter((p) => p.type === "damage_detail").length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Hasar Fotoğrafları ({intake.photos.filter((p) => p.type === "damage_detail").length})</CardTitle></CardHeader>
              <CardContent>
                <PhotoGalleryGrid photos={intake.photos.filter((p) => p.type === "damage_detail")} />
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="share">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Share2 className="size-4" /> Müşteri Çıktısı</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Müşteriyle paylaşabileceğiniz salt-görüntü bir özet linki oluşturun. Müşteri bu sayfadan araç kabul ve işlem detaylarını görüntüleyebilir.
              </p>
              {!shareToken && (
                <Button onClick={handleGenerateShareLink} disabled={loading} size="lg" className="w-full">
                  <Share2 className="size-4 mr-2" /> Müşteri Çıktı Linki Oluştur
                </Button>
              )}
              {shareToken && (
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-sm font-medium mb-2">Müşteri Çıktı Linki:</p>
                  <div className="break-all text-sm bg-background p-3 rounded-lg">
                    <a
                      href={`/s/${shareToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`}
                    </a>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        const publicLink = typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`
                        const orderItems = intake.order?.items ?? []
                        const totalAmount = orderItems.reduce((sum, item) => {
                          if (item.totalPrice) return sum + item.totalPrice
                          if (item.unitPrice) return sum + item.unitPrice * item.quantity
                          return sum
                        }, 0)
                        const text = generateWhatsAppShareText({ publicLink, totalAmount: totalAmount > 0 ? totalAmount : null })
                        window.open(getWhatsAppSendUrl(intake.customer.phone, text), "_blank")
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
                    >
                        WhatsApp ile Gönder
                      </button>
                      <button
                        onClick={async () => {
                          const publicLink = typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`
                          try { await navigator.clipboard.writeText(publicLink) } catch {}
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                      >
                        Linki Kopyala
                      </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Bu linki müşterinizle paylaşabilirsiniz. Müşteri bu sayfadan araç kabul detaylarını görüntüleyebilir.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="order">
        <div className="space-y-4">
          {!intake.order ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> Servis Emri</CardTitle></CardHeader>
              <CardContent className="text-center py-6">
                <Wrench className="size-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm text-muted-foreground mb-4">Henüz servis emri oluşturulmadı</p>
                <Button onClick={handleCreateOrder} disabled={loading} size="lg">
                  Servis Emri Oluştur
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Servis Emri Kalemleri</CardTitle>
                    <Badge variant="outline">{ORDER_STATUS_LABELS[intake.order.status as keyof typeof ORDER_STATUS_LABELS] || intake.order.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {intake.order.items.length === 0 ? (
                    <div className="text-center py-6">
                      <Wrench className="size-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {intake.order.items.map((item) => {
                        const lineTotal = item.totalPrice || (item.unitPrice && item.unitPrice * item.quantity) || null
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{item.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 bg-primary/10 text-foreground">
                                  {item.type === "part" ? "Parça" : "İşçilik"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.quantity} adet {item.unitPrice ? `× ${formatTRY(item.unitPrice)}` : ""}
                                {item.note && ` • ${item.note}`}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <span className={`text-sm font-medium ${lineTotal == null ? "text-muted-foreground italic text-xs" : ""}`}>
                                {lineTotal != null ? formatTRY(lineTotal) : "Fiyat girilmedi"}
                              </span>
                              <button
                                onClick={async () => {
                                  await fetch(`/api/orders/items?id=${item.id}&orderId=${intake.order!.id}`, { method: "DELETE" })
                                  router.refresh()
                                }}
                                className="block text-destructive text-xs hover:underline mt-0.5 ml-auto"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex justify-between items-center pt-3 border-t text-sm">
                        <span className="font-medium">Toplam</span>
                        <span className="font-bold text-base">
                          {formatTRY(
                            intake.order.items.reduce((sum, item) => {
                              if (item.totalPrice) return sum + item.totalPrice
                              if (item.unitPrice) return sum + item.unitPrice * item.quantity
                              return sum
                            }, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="lg" onClick={() => { setShowOrderItemForm(true); setItemType("part"); setItemName(""); setItemQty("1"); setItemPrice("") }} className="w-full">
                    <Plus className="size-4 mr-1" /> Kalem Ekle
                  </Button>

                  <div className="flex gap-2 pt-2">
                    {intake.order.status === "draft" && (
                      <Button size="lg" className="flex-1" onClick={async () => {
                        await fetch(`/api/orders/${intake.order!.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "in_progress" }),
                        })
                        router.refresh()
                      }}>İşleme Başla</Button>
                    )}
                    {intake.order.status === "in_progress" && (
                      <Button size="lg" className="flex-1" onClick={async () => {
                        await fetch(`/api/orders/${intake.order!.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "ready_for_delivery" }),
                        })
                        router.refresh()
                      }}>Teslimata Hazır</Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {showOrderItemForm && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Yeni Kalem Ekle</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Tip</Label>
                      <Select
                        value={itemType}
                        onValueChange={(v) => setItemType(v ?? "part")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Tip seçin">
                            {(value: string | null) => (value ? ORDER_ITEM_TYPE_LABELS[value] ?? value : null)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="part">Parça</SelectItem>
                          <SelectItem value="labor">İşçilik</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Kalem Adı</Label>
                      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Fren balatası, Yağ değişimi..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Miktar</Label>
                        <Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} min="1" />
                      </div>
                      <div>
                        <Label>Birim Fiyat (TL)</Label>
                        <Input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="0" min="0" step="0.01" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleAddOrderItem} disabled={loading || !itemName} size="lg" className="flex-1">Ekle</Button>
                      <Button variant="outline" onClick={() => setShowOrderItemForm(false)} size="lg">İptal</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </TabsContent>
      </Tabs>
    </div>
  )
}

function PhotoChecklistItem({
  photoKey,
  label,
  taken,
  required,
  intakeId,
}: {
  photoKey: string
  label: string
  taken: boolean
  required: boolean
  intakeId: string
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleCaptureAdd() {
    if (!selectedFile) {
      const formData = new FormData()
      formData.set("intakeFormId", intakeId)
      formData.set("type", photoKey)
      formData.set("label", label)
      try {
        const res = await fetch("/api/intakes/photos", { method: "POST", body: formData })
        const data = await res.json()
        if (data.success) {
          router.refresh()
        }
      } catch {}
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.set("intakeFormId", intakeId)
    formData.set("type", photoKey)
    formData.set("label", label)
    formData.set("file", selectedFile)

    try {
      const res = await fetch("/api/intakes/photos", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setSelectedFile(null)
        setPreview(null)
        if (inputRef.current) inputRef.current.value = ""
        router.refresh()
      }
    } catch {
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`flex flex-col rounded-lg text-sm ${
        taken ? "bg-success/10 border border-success/20" : required ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30 border border-muted"
      }`}
    >
      <div className="flex items-center justify-between p-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {taken ? (
            <CheckCircle2 className="size-4 text-success shrink-0" />
          ) : required ? (
            <Camera className="size-4 text-destructive shrink-0" />
          ) : (
            <Camera className="size-4 text-muted-foreground/40 shrink-0" />
          )}
          <span className={taken ? "" : "text-muted-foreground"}>{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!taken && !selectedFile && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs text-primary hover:underline font-medium"
            >
              Fotoğraf çek / yükle
            </button>
          )}
          {taken && (
            <span className="text-xs font-medium text-success">✓ Tamam</span>
          )}
        </div>
      </div>

      {!taken && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setSelectedFile(file)
              setPreview(URL.createObjectURL(file))
            }}
          />
          {preview && (
            <div className="px-2.5 pb-2.5">
              <div className="relative rounded-lg overflow-hidden border bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={`${label} önizlemesi`}
                  className="w-full max-h-36 object-contain"
                />
                <div className="flex gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreview(null)
                      if (inputRef.current) inputRef.current.value = ""
                    }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Tekrar çek / değiştir
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureAdd}
                    disabled={uploading}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {uploading ? <Loader2 className="size-3 animate-spin inline" /> : null}
                    {uploading ? " Yükleniyor..." : "Kaydet"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  in_progress: "İşlemde",
  ready_for_delivery: "Teslimat için hazır",
  delivered: "Teslim edildi",
  cancelled: "İptal",
}