"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import { INTAKE_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES } from "@/lib/constants"
import { VehicleDamageMap } from "@/components/damage/vehicle-damage-map"

type IntakeDetailProps = {
  id: string
  status: string
  mileageAtIntake: number | null
  customerComplaint: string
  internalNote: string | null
  approvedAt: Date | null
  createdAt: Date
  customer: { id: string; firstName: string; lastName: string; phone: string; email: string | null }
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
  photos: { id: string; type: string; label: string; required: boolean; fileUrl: string | null; note: string | null }[]
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  approvals: { id: string; status: string; otpCode: string; createdAt: Date }[]
  shareLinks: { id: string; token: string; isActive: boolean }[]
  order: { id: string; status: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
}

export function IntakeDetail({ intake }: { intake: IntakeDetailProps }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"info" | "photos" | "damage" | "approval" | "order">("info")
  const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]

  // Damage mark modal state
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [selectedZone, setSelectedZone] = useState("")
  const [damageType, setDamageType] = useState("")
  const [severity, setSeverity] = useState("")
  const [damageNote, setDamageNote] = useState("")

  // Approval state
  const [otpCode, setOtpCode] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalVerified, setApprovalVerified] = useState(intake.status === "approved" || intake.status === "in_progress" || intake.status === "ready_for_delivery" || intake.status === "delivered")
  const [shareToken, setShareToken] = useState(intake.shareLinks[0]?.token || "")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Photo upload state
  const [photoType, setPhotoType] = useState("")
  const [photoNote, setPhotoNote] = useState("")

  // Service order state
  const [showOrderItemForm, setShowOrderItemForm] = useState(false)
  const [itemType, setItemType] = useState("part")
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")

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

    try {
      const res = await fetch("/api/intakes/photos", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setPhotoType("")
        setPhotoNote("")
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
        setError(data.error || "Sipariş oluşturulamadı")
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

  const tabs = [
    { id: "info" as const, label: "Bilgiler", icon: ClipboardList },
    { id: "photos" as const, label: "Fotoğraflar", icon: Camera },
    { id: "damage" as const, label: "Hasar", icon: AlertTriangle },
    { id: "approval" as const, label: "Onay", icon: MessageSquare },
    { id: "order" as const, label: "Sipariş", icon: Plus },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/app/intakes")} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{intake.vehicle.plate}</h2>
            <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
              {statusInfo?.label || intake.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {intake.vehicle.brand} {intake.vehicle.model} - {intake.customer.firstName} {intake.customer.lastName}
          </p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Status actions */}
      <div className="flex gap-2 overflow-x-auto">
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Müşteri Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" />{intake.customer.firstName} {intake.customer.lastName}</div>
                <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{intake.customer.phone}</div>
                {intake.customer.email && <div className="text-muted-foreground">{intake.customer.email}</div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Araç Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Car className="size-4 text-muted-foreground" />{intake.vehicle.plate} - {intake.vehicle.brand} {intake.vehicle.model}</div>
                {intake.vehicle.modelYear && <div>Model Yılı: {intake.vehicle.modelYear}</div>}
                {intake.mileageAtIntake && <div>Kilometre: {intake.mileageAtIntake.toLocaleString("tr-TR")} km</div>}
                {intake.vehicle.vin && <div>VIN: {intake.vehicle.vin}</div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Kabul Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Şikayet:</strong> {intake.customerComplaint}</div>
                {intake.internalNote && <div><strong>İç Not:</strong> {intake.internalNote}</div>}
                <div className="text-muted-foreground">{new Date(intake.createdAt).toLocaleDateString("tr-TR")}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "photos" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Fotoğraf Ekle</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Fotoğraf Türü</Label>
                <select
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value)}
                >
                  <option value="">Seçin...</option>
                  {Object.entries(PHOTO_TYPES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Not</Label>
                <Input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Fotoğraf notu..." />
              </div>
              <p className="text-xs text-muted-foreground">
                Not: v0.1.0&apos;da gerçek dosya yükleme henüz aktif değil. Fotoğraf kayıtları veritabanında tutulur.
                Supabase Storage/S3 entegrasyonu gelecekte eklenecektir.
              </p>
              <Button onClick={handleAddPhoto} disabled={loading || !photoType}>
                <Plus className="size-4 mr-1" /> Fotoğraf Kaydı Ekle
              </Button>
            </CardContent>
          </Card>

          {intake.photos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Kaydedilmiş Fotoğraflar ({intake.photos.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intake.photos.map((photo) => (
                    <div key={photo.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">{PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type}</span>
                        {photo.note && <span className="text-xs text-muted-foreground ml-2">- {photo.note}</span>}
                      </div>
                      <button onClick={() => handleRemovePhoto(photo.id)} className="text-destructive hover:underline text-xs">Kaldır</button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "damage" && (
        <div className="space-y-4">
          <VehicleDamageMap
            damageMarks={intake.damageMarks}
            onZoneClick={(zone) => {
              setSelectedZone(zone)
              setShowDamageModal(true)
            }}
          />

          {intake.damageMarks.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Hasar Kayıtları ({intake.damageMarks.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intake.damageMarks.map((mark) => (
                    <div key={mark.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium">{VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType}
                          ({DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]?.label || mark.severity})
                        </span>
                        {mark.note && <span className="text-xs ml-2">- {mark.note}</span>}
                      </div>
                      <button onClick={() => handleRemoveDamageMark(mark.id)} className="text-destructive hover:underline text-xs">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Damage modal */}
          {showDamageModal && (
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50" onClick={() => setShowDamageModal(false)}>
              <div className="bg-card w-full md:max-w-md md:rounded-xl rounded-t-xl p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold">
                  Hasar Ekle: {VEHICLE_ZONES[selectedZone as keyof typeof VEHICLE_ZONES] || selectedZone}
                </h3>
                <div>
                  <Label>Hasar Tipi</Label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value)}
                  >
                    <option value="">Seçin...</option>
                    {Object.entries(DAMAGE_TYPES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Şiddet</Label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="">Seçin...</option>
                    {Object.entries(DAMAGE_SEVERITY).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Not</Label>
                  <Input value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="Hasar notu..." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddDamageMark} disabled={loading || !damageType || !severity} className="flex-1">
                    Kaydet
                  </Button>
                  <Button variant="outline" onClick={() => setShowDamageModal(false)} className="flex-1">
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "approval" && (
        <div className="space-y-4">
          {!approvalSent && !approvalVerified && (
            <Card>
              <CardHeader><CardTitle className="text-base">Müşteri Onayı</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Müşteriye SMS ile onay kodu gönderilecektir.
                </p>
                <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                  Demo modunda SMS gönderilmez. Test kodu ekranda gösterilir.
                </div>
                <Button onClick={handleRequestApproval} disabled={loading} className="w-full">
                  <MessageSquare className="size-4 mr-2" /> Onay Talebi Oluştur
                </Button>
              </CardContent>
            </Card>
          )}

          {approvalSent && generatedOtp && !approvalVerified && (
            <Card>
              <CardHeader><CardTitle className="text-base">Onay Kodu</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 rounded-lg bg-green-50 text-green-800 text-center">
                  <p className="text-sm">Onay kodu (demo):</p>
                  <p className="text-3xl font-bold tracking-widest mt-1">{generatedOtp}</p>
                </div>
                <div>
                  <Label>Onay Kodu</Label>
                  <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" />
                </div>
                <Button onClick={handleVerifyOtp} disabled={loading || !otpCode} className="w-full">
                  <CheckCircle2 className="size-4 mr-2" /> Onay Kodunu Doğrula
                </Button>
              </CardContent>
            </Card>
          )}

          {approvalVerified && (
            <Card>
              <CardHeader><CardTitle className="text-base">Onaylanmış</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-5" />
                  Müşteri onayı başarıyla doğrulanmış.
                </div>
                {!shareToken && (
                  <Button onClick={handleGenerateShareLink} disabled={loading} className="w-full">
                    <Share2 className="size-4 mr-2" /> Müşteri Çıktı Linki Oluştur
                  </Button>
                )}
                {shareToken && (
                  <div className="p-3 bg-muted rounded-lg break-all text-sm">
                    <p className="font-medium mb-1">Müşteri çıktı linki:</p>
                    <a href={`/s/${shareToken}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "order" && (
        <div className="space-y-4">
          {!intake.order ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Servis Emri</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Henüz servis emri oluşturulmadı.</p>
                <Button onClick={handleCreateOrder} disabled={loading}>
                  Servis Emri Oluştur
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Servis Emri</CardTitle>
                    <Badge variant="outline">{ORDER_STATUS_LABELS[intake.order.status as keyof typeof ORDER_STATUS_LABELS] || intake.order.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {intake.order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {item.type === "part" ? "Parça" : "İşçilik"} x{item.quantity}
                          </span>
                          {item.note && <span className="text-xs text-muted-foreground ml-2">- {item.note}</span>}
                        </div>
                        <button onClick={async () => {
                          await fetch(`/api/orders/items?id=${item.id}&orderId=${intake.order!.id}`, { method: "DELETE" })
                          router.refresh()
                        }} className="text-destructive text-xs hover:underline">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                    {intake.order.items.length === 0 && (
                      <p className="text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowOrderItemForm(true)}>
                    <Plus className="size-4 mr-1" /> Kalem Ekle
                  </Button>
                  <div className="flex gap-2 pt-2">
                    {intake.order.status === "draft" && (
                      <Button size="sm" onClick={async () => {
                        await fetch(`/api/orders/${intake.order!.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "in_progress" }),
                        })
                        router.refresh()
                      }}>İşleme Başla</Button>
                    )}
                    {intake.order.status === "in_progress" && (
                      <Button size="sm" onClick={async () => {
                        await fetch(`/api/orders/${intake.order!.id}/status`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "ready_for_delivery" }),
                        })
                        router.refresh()
                      }}>Hazır</Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {showOrderItemForm && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Yeni Kalem</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Tip</Label>
                      <select
                        className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value)}
                      >
                        <option value="part">Parça</option>
                        <option value="labor">İşçilik</option>
                      </select>
                    </div>
                    <div><Label>Ad</Label><Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Fren balatası" /></div>
                    <div><Label>Miktar</Label><Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} /></div>
                    <div><Label>Birim Fiyat</Label><Input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="0" /></div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddOrderItem} disabled={loading || !itemName}>Ekle</Button>
                      <Button variant="outline" onClick={() => setShowOrderItemForm(false)}>İptal</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
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