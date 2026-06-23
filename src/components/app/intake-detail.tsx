"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  MessageSquare,
  Info,
  Wrench,
  Upload,
  RefreshCw,
  ImageOff,
  Loader2,
  BarChart3,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { INTAKE_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES } from "@/lib/constants"
import { ServiceAdvisorPanel } from "@/components/app/service-advisor-panel"
import { AdvisorPremiumLock } from "@/components/app/advisor-premium-lock"
import { VehicleDamageMap } from "@/components/damage/vehicle-damage-map"
import { formatTRY } from "@/lib/format"
import { generateWhatsAppShareText, getWhatsAppShareUrl } from "@/lib/share/whatsapp"
import { calculatePhotoCompletion, groupPhotosByPhase } from "@/lib/intake/completeness"
import { IntakeEvidenceSummary } from "@/components/app/intake-evidence-summary"
import { ApprovalTimeline } from "@/components/app/approval-timeline"

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
  order: { id: string; status: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
}

export function IntakeDetail({ intake, hasAiAdvisor }: { intake: IntakeDetailProps; hasAiAdvisor: boolean }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"info" | "photos" | "damage" | "approval" | "order" | "evidence">("info")
  const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]

  const [showDamageModal, setShowDamageModal] = useState(false)
  const [selectedZone, setSelectedZone] = useState("")
  const [damageType, setDamageType] = useState("")
  const [severity, setSeverity] = useState("")
  const [damageNote, setDamageNote] = useState("")

  const [otpCode, setOtpCode] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalVerified, setApprovalVerified] = useState(intake.status === "approved" || intake.status === "in_progress" || intake.status === "ready_for_delivery" || intake.status === "delivered")
  const [shareToken, setShareToken] = useState(intake.shareLinks[0]?.token || "")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [photoType, setPhotoType] = useState("")
  const [photoPhase, setPhotoPhase] = useState("intake")
  const [photoNote, setPhotoNote] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)

  const [showOrderItemForm, setShowOrderItemForm] = useState(false)
  const [itemType, setItemType] = useState("part")
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")

  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [serviceInfoAccepted, setServiceInfoAccepted] = useState(false)
  const [promoAccepted, setPromoAccepted] = useState(false)

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

  async function handleAddDamageMark() {
    setLoading(true)
    setError("")
    const formData = new FormData()
    formData.set("intakeFormId", intake.id)
    formData.set("zone", selectedZone)
    formData.set("damageType", damageType)
    formData.set("severity", severity)
    if (damageNote) formData.set("note", damageNote)

    try {
      const res = await fetch("/api/intakes/damage", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setShowDamageModal(false)
        setSelectedZone("")
        setDamageType("")
        setSeverity("")
        setDamageNote("")
        router.refresh()
      } else {
        setError(data.error || "Hasar eklenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveDamageMark(markId: string) {
    try {
      await fetch(`/api/intakes/damage?id=${markId}&intakeFormId=${intake.id}`, { method: "DELETE" })
      router.refresh()
    } catch {}
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

  async function handleRemovePhoto(id: string) {
    try {
      await fetch(`/api/intakes/photos?id=${id}&intakeFormId=${intake.id}`, { method: "DELETE" })
      router.refresh()
    } catch {}
  }

  async function handleReplacePhoto(photoId: string, file: File) {
    setUploadingPhotoId(photoId)
    setError("")
    const formData = new FormData()
    formData.set("photoId", photoId)
    formData.set("intakeFormId", intake.id)
    formData.set("file", file)

    try {
      const res = await fetch("/api/intakes/photos", { method: "PUT", body: formData })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Fotoğraf değiştirilemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setUploadingPhotoId(null)
    }
  }

  async function handleRequestApproval() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/approval`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setGeneratedOtp(data.otpCode)
        setApprovalSent(true)
      } else {
        setError(data.error || "Onay talebi oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode }),
      })
      const data = await res.json()
      if (data.success) {
        setApprovalVerified(true)
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
    if (itemPrice) formData.set("unitPrice", itemPrice)

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

  const tabs = [
    { id: "info" as const, label: "Bilgiler", icon: ClipboardList },
    { id: "evidence" as const, label: "Kanıt", icon: Camera, count: intake.photos.length },
    { id: "photos" as const, label: "Fotoğraflar", icon: Camera },
    { id: "damage" as const, label: "Hasar", icon: AlertTriangle, count: intake.damageMarks.length },
    { id: "approval" as const, label: "Onay", icon: MessageSquare },
    { id: "order" as const, label: "Sipariş", icon: Wrench },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/app/intakes")} className="p-2.5 hover:bg-muted rounded-lg touch-manipulation">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold truncate">{intake.vehicle.plate}</h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusInfo?.color || "bg-muted text-muted-foreground"}`}>
              {statusInfo?.label || intake.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {intake.vehicle.brand} {intake.vehicle.model} - {intake.customer.type === "corporate"
              ? intake.customer.companyName || "Kurumsal Müşteri"
              : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-foreground text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Status actions */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {intake.status === "draft" && (
          <Button size="sm" onClick={() => handleStatusChange("waiting_approval")} disabled={loading}>
            Onay İste
          </Button>
        )}
        {intake.status === "approved" && !intake.order && (
          <Button size="sm" onClick={handleCreateOrder} disabled={loading}>
            Servis Emri Oluştur
          </Button>
        )}
        {intake.status === "approved" && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("in_progress")} disabled={loading}>
            İşleme Başla
          </Button>
        )}
        {intake.status === "in_progress" && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("ready_for_delivery")} disabled={loading}>
            Teslimata Hazır
          </Button>
        )}
        {intake.status === "ready_for_delivery" && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("delivered")} disabled={loading}>
            Teslim Edildi
          </Button>
        )}
        {(intake.status === "draft" || intake.status === "waiting_approval") && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("cancelled")} disabled={loading} className="text-destructive">
            İptal Et
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList variant="line" className="border-b gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="px-3 py-2.5">
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
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="size-4" /> Kabul Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Müşteri Şikayeti:</span>
                  <p className="mt-1 text-muted-foreground">{intake.customerComplaint}</p>
                </div>
                {intake.internalNote && (
                  <div>
                    <span className="font-medium">İç Not:</span>
                    <p className="mt-1 text-muted-foreground">{intake.internalNote}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Oluşturulma: {new Date(intake.createdAt).toLocaleDateString("tr-TR")}
                  {intake.approvedAt && <> • Onay: {new Date(intake.approvedAt).toLocaleDateString("tr-TR")}</>}
                </div>
              </div>
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
                Kabul Kanıt Paneli
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IntakeEvidenceSummary
                photoCompletion={photoCompletion}
                damageCount={intake.damageMarks.length}
                approvalStatus={approvalStatus}
                publicLinkStatus={publicLinkStatus}
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
                        <div className="grid grid-cols-3 gap-2">
                          {groupPhotos.map((photo) => (
                            <PhotoGalleryCard
                              key={photo.id}
                              photo={photo}
                              onRemove={handleRemovePhoto}
                              onReplace={handleReplacePhoto}
                              isUploading={uploadingPhotoId === photo.id}
                            />
                          ))}
                        </div>
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
                      onRemove={handleRemovePhoto}
                      onReplace={handleReplacePhoto}
                      photos={intake.photos}
                      intakeId={intake.id}
                      uploadingPhotoId={uploadingPhotoId}
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
                        onRemove={handleRemovePhoto}
                        onReplace={handleReplacePhoto}
                        photos={intake.photos}
                        intakeId={intake.id}
                        uploadingPhotoId={uploadingPhotoId}
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
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Seçiniz..." />
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
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Aşama seçin" />
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
              <Button onClick={handleAddPhoto} disabled={loading || !photoType} size="lg" className="w-full h-12">
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
                <div className="grid grid-cols-2 gap-3">
                  {intake.photos.map((photo) => (
                    <PhotoGalleryCard
                      key={photo.id}
                      photo={photo}
                      onRemove={handleRemovePhoto}
                      onReplace={handleReplacePhoto}
                      isUploading={uploadingPhotoId === photo.id}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="damage">
        <div className="space-y-4">
          <VehicleDamageMap
            damageMarks={intake.damageMarks}
            onZoneClick={(zone) => {
              setSelectedZone(zone)
              setDamageType("")
              setSeverity("")
              setDamageNote("")
              setShowDamageModal(true)
            }}
            onRemoveMark={handleRemoveDamageMark}
            vehicle={{ plate: intake.vehicle.plate, brand: intake.vehicle.brand, model: intake.vehicle.model }}
          />

          <Dialog open={showDamageModal} onOpenChange={setShowDamageModal}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Hasar Ekle: {VEHICLE_ZONES[selectedZone as keyof typeof VEHICLE_ZONES] || selectedZone}
                </DialogTitle>
              </DialogHeader>
                <div>
                  <Label>Hasar Tipi</Label>
                  <Select
                    value={damageType}
                    onValueChange={(v) => setDamageType(v ?? "")}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Seçiniz..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Seçiniz...</SelectItem>
                      {Object.entries(DAMAGE_TYPES).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Şiddet</Label>
                  <ToggleGroup value={severity ? [severity] : []} onValueChange={(v) => setSeverity(v[0] ?? "")} variant="outline" className="w-full mt-1">
                    {Object.entries(DAMAGE_SEVERITY).map(([key, val]) => (
                      <ToggleGroupItem key={key} value={key} className="flex-1 py-3">
                        <span className="w-3 h-3 rounded-full inline-block mr-1.5" style={{ backgroundColor: val.color }} />
                        {val.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div>
                  <Label>Not</Label>
                  <Input value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="Hasar açıklaması..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleAddDamageMark} disabled={loading || !damageType || !severity} size="lg" className="flex-1 h-12">
                    Kaydet
                  </Button>
                  <Button variant="outline" onClick={() => setShowDamageModal(false)} size="lg" className="h-12">
                    İptal
                  </Button>
                </div>
            </DialogContent>
          </Dialog>
        </div>
      </TabsContent>

      <TabsContent value="approval">
        <div className="space-y-4">
          {!approvalSent && !approvalVerified && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="size-4" /> Müşteri Onayı</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Müşteri onayı için SMS ile doğrulama kodu gönderilir.
                </p>
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-foreground text-sm">
                  <p className="font-medium mb-1">Demo Modu</p>
                  <p>Demo modunda SMS gönderilmez. Test kodu ekranda gösterilir. Gerçek SMS entegrasyonu sonraki sürümlerde eklenecektir.</p>
                </div>

                <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                  <p className="text-sm font-medium">Onay Gereksinimleri</p>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="detail-terms"
                      checked={termsAccepted}
                      onCheckedChange={(c) => setTermsAccepted(c)}
                      className="mt-0.5"
                    />
                    <label htmlFor="detail-terms" className="text-sm">
                      Araç kabul formunu onaylıyorum. <span className="text-destructive">*</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="detail-privacy"
                      checked={privacyAccepted}
                      onCheckedChange={(c) => setPrivacyAccepted(c)}
                      className="mt-0.5"
                    />
                    <label htmlFor="detail-privacy" className="text-sm">
                      Aydınlatma metnini okudum. <span className="text-destructive">*</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="detail-serviceInfo"
                      checked={serviceInfoAccepted}
                      onCheckedChange={(c) => setServiceInfoAccepted(c)}
                      className="mt-0.5"
                    />
                    <label htmlFor="detail-serviceInfo" className="text-sm text-muted-foreground">
                      Servis süreciyle ilgili bilgilendirme almak istiyorum.
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="detail-promo"
                      checked={promoAccepted}
                      onCheckedChange={(c) => setPromoAccepted(c)}
                      className="mt-0.5"
                    />
                    <label htmlFor="detail-promo" className="text-sm text-muted-foreground">
                      Kampanya ve ticari ileti almak istiyorum.
                    </label>
                  </div>
                </div>

                <Button onClick={handleRequestApproval} disabled={loading || !termsAccepted || !privacyAccepted} size="lg" className="w-full h-12">
                  <MessageSquare className="size-4 mr-2" /> Onay Talebi Oluştur
                </Button>
              </CardContent>
            </Card>
          )}

          {approvalSent && generatedOtp && !approvalVerified && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Onay Kodu Doğrulama</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-5 rounded-lg bg-success/10 border-2 border-success/20 text-foreground text-center">
                  <p className="text-sm font-medium mb-2">Demo Test Kodu</p>
                  <p className="text-4xl font-bold tracking-[0.3em]">{generatedOtp}</p>
                  <p className="text-xs mt-2 text-success">Bu kodu müşteriye göstererek onay alabilirsiniz</p>
                </div>
                <div>
                  <Label>Onay Kodu</Label>
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 haneli kodu giriniz"
                    className="h-14 text-center text-2xl tracking-widest"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>
                <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length < 4} size="lg" className="w-full h-12">
                  <CheckCircle2 className="size-4 mr-2" /> Onay Kodunu Doğrula
                </Button>
              </CardContent>
            </Card>
          )}

          {approvalVerified && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Onaylanmış</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-foreground text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <span>Müşteri onayı başarıyla doğrulandı.</span>
                </div>
                {!shareToken && (
                  <Button onClick={handleGenerateShareLink} disabled={loading} size="lg" className="w-full h-12">
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
                          window.open(getWhatsAppShareUrl(text), "_blank")
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
                      >
                          WhatsApp ile Paylaş
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
          )}
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
                <Button onClick={handleCreateOrder} disabled={loading} size="lg" className="h-12">
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

                  <Button variant="outline" size="lg" onClick={() => { setShowOrderItemForm(true); setItemType("part"); setItemName(""); setItemQty("1"); setItemPrice("") }} className="w-full h-10">
                    <Plus className="size-4 mr-1" /> Kalem Ekle
                  </Button>

                  <div className="flex gap-2 pt-2">
                    {intake.order.status === "draft" && (
                      <Button size="lg" className="flex-1 h-12" onClick={async () => {
                        await fetch(`/api/orders/${intake.order!.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "in_progress" }),
                        })
                        router.refresh()
                      }}>İşleme Başla</Button>
                    )}
                    {intake.order.status === "in_progress" && (
                      <Button size="lg" className="flex-1 h-12" onClick={async () => {
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
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Tip seçin" />
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
                      <Button onClick={handleAddOrderItem} disabled={loading || !itemName} size="lg" className="flex-1 h-12">Ekle</Button>
                      <Button variant="outline" onClick={() => setShowOrderItemForm(false)} size="lg" className="h-12">İptal</Button>
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

function PhotoGalleryCard({
  photo,
  onRemove,
  onReplace,
  isUploading,
}: {
  photo: VehiclePhoto
  onRemove: (id: string) => void
  onReplace: (photoId: string, file: File) => void
  isUploading: boolean
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-white">
      <div className="relative aspect-square bg-muted flex items-center justify-center">
        {photo.fileUrl ? (
          <PhotoThumbnail photoId={photo.id} fileUrl={photo.fileUrl} />
        ) : (
          <div className="text-center p-3">
            <ImageOff className="size-8 text-muted-foreground/30 mx-auto mb-1" />
            <span className="text-xs text-muted-foreground">Dosya yok</span>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="size-8 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{typeLabel}</span>
          <button
            onClick={() => onRemove(photo.id)}
            className="text-destructive hover:bg-destructive/10 p-1 rounded touch-manipulation"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {photo.fileName && (
          <p className="text-xs text-muted-foreground truncate">{photo.fileName}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {photo.sizeBytes != null && <span>{formatSize(photo.sizeBytes)}</span>}
          {photo.mimeType && (
            <span className="uppercase">{photo.mimeType.split("/")[1]}</span>
          )}
        </div>
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onReplace(photo.id, file)
          }}
        />
        <button
          onClick={() => replaceInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-primary hover:bg-primary/5 rounded-lg touch-manipulation"
          disabled={isUploading}
        >
          <RefreshCw className="size-3" />
          Tekrar çek / değiştir
        </button>
      </div>
    </div>
  )
}

function PhotoThumbnail({ photoId, fileUrl }: { photoId: string; fileUrl: string }) {
  const [src, setSrc] = useState<string | null>(() =>
    fileUrl.startsWith("data:") ? fileUrl : null
  )
  const [loading, setLoading] = useState(() => !fileUrl.startsWith("data:"))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (fileUrl.startsWith("data:")) return

    let cancelled = false
    fetch(`/api/photos?id=${photoId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.blob()
      })
      .then((blob) => {
        if (!cancelled) {
          setSrc(URL.createObjectURL(blob))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [photoId, fileUrl])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Loader2 className="size-6 text-muted-foreground/40 animate-spin" />
      </div>
    )
  }

  if (failed || !src) {
    return (
      <div className="text-center p-3">
        <ImageOff className="size-8 text-muted-foreground/30 mx-auto mb-1" />
        <span className="text-xs text-muted-foreground">Yüklenemedi</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Fotoğraf"
      className="w-full h-full object-cover"
    />
  )
}

function PhotoChecklistItem({
  photoKey,
  label,
  taken,
  required,
  onRemove,
  onReplace,
  photos,
  intakeId,
  uploadingPhotoId,
}: {
  photoKey: string
  label: string
  taken: boolean
  required: boolean
  onRemove: (id: string) => void
  onReplace: (photoId: string, file: File) => void
  photos: { id: string; type: string; label: string; fileUrl: string | null; fileName: string | null; mimeType: string | null; sizeBytes: number | null }[]
  intakeId: string
  uploadingPhotoId: string | null
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const existingPhoto = photos.find((p) => p.type === photoKey)
  const isUploading = uploadingPhotoId === existingPhoto?.id

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
            <>
              <span className="text-xs font-medium text-success">✓ Tamam</span>
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && existingPhoto) onReplace(existingPhoto.id, file)
                }}
              />
              <button
                type="button"
                onClick={() => replaceInputRef.current?.click()}
                className="text-xs text-primary hover:underline"
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="size-3 animate-spin" /> : "Değiştir"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (existingPhoto) onRemove(existingPhoto.id)
                }}
                className="text-xs text-destructive hover:underline"
              >
                Kaldır
              </button>
            </>
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