"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Car,
  User,
  Wrench,
  AlertTriangle,
  Camera,
  BellRing,
  Copy,
  CheckCircle2,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Calendar,
  Gauge,
  Phone,
  FileText,
  Clock,
  ChevronRight,
  ExternalLink,
  Share2,
} from "lucide-react"
import { PlateBadge } from "@/components/app/plate-badge"
import { PassportQRCode } from "@/components/app/passport-qr-code"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ORDER_STATUS, PAYMENT_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, PHOTO_TYPES, MAINTENANCE_REMINDER_TYPES, MAINTENANCE_REMINDER_STATUS } from "@/lib/constants"
import { formatTRY, formatMileage, customerDisplayName } from "@/lib/format"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

type PassportData = {
  vehicle: {
    id: string
    plate: string
    brand: string
    model: string
    vehicleType: string | null
    modelYear: number | null
    mileage: number | null
    vin: string | null
    vinConfirmed: boolean
    color: string | null
    engineNo: string | null
    fuelType: string | null
    transmission: string | null
    notes: string | null
    createdAt: string
  }
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    contactName: string | null
    phone: string
    email: string | null
    city: string | null
  }
  intakes: Array<{
    id: string
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    internalNote: string | null
    createdAt: string
    approvedAt: string | null
    timelineEvents: Array<{ eventType: string; description: string; createdAt: string }>
    order: {
      id: string
      workOrderNo: string | null
      status: string
      paymentStatus: string
      grandTotal: number
      estimatedDeliveryAt: string | null
      items: Array<{ type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }>
    } | null
    damageMarks: Array<{
      id: string
      zone: string
      damageType: string
      severity: string
      note: string | null
      createdAt: string
    }>
    photos: Array<{
      id: string
      type: string
      label: string
      fileUrl: string | null
      phase: string | null
      createdAt: string
    }>
  }>
  reminders: Array<{
    id: string
    title: string
    type: string
    status: string
    dueDate: string | null
    dueMileage: number | null
    customerNote: string | null
    internalNote: string | null
    completedAt: string | null
    lastServiceDate: string | null
    lastServiceMileage: number | null
  }>
  tokens: Array<{
    id: string
    token: string
    label: string | null
    isActive: boolean
    expiresAt: string | null
    showServiceHistory: boolean
    showWorkOrders: boolean
    showDamages: boolean
    showPhotos: boolean
    showReminders: boolean
    showPaymentStatus: boolean
    createdAt: string
  }>
  workshop: {
    name: string
    phone: string
    city: string
    address: string
    logoUrl: string | null
  }
}

export function VehiclePassport({ data }: { data: PassportData }) {
  const { vehicle, customer, intakes, reminders, tokens } = data
  const workOrders = intakes.filter((i) => i.order)
  const allDamageMarks = intakes.flatMap((i) =>
    i.damageMarks.map((dm) => ({ ...dm, intakeId: i.id, intakeDate: i.createdAt }))
  )
  const allPhotos = intakes.flatMap((i) =>
    i.photos.map((p) => ({ ...p, intakeId: i.id }))
  )
  const allTimelineEvents = intakes
    .flatMap((i) => i.timelineEvents.map((e) => ({ ...e, intakeId: i.id })))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newExpiry, setNewExpiry] = useState("")
  const [newVisibility, setNewVisibility] = useState({
    showServiceHistory: true,
    showWorkOrders: true,
    showDamages: true,
    showPhotos: true,
    showReminders: true,
    showPaymentStatus: false,
  })

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/passport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel || undefined,
          expiresAt: newExpiry || undefined,
          ...newVisibility,
        }),
      })
      if (res.ok) {
        window.location.reload()
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(tokenId: string, currentlyActive: boolean) {
    setToggling(tokenId)
    try {
      const token = tokens.find((t) => t.id === tokenId)
      if (!token) return
      await fetch(`/api/vehicles/${vehicle.id}/passport/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentlyActive }),
      })
      window.location.reload()
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(tokenId: string) {
    if (!confirm("Bu pasaport token'ını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return
    try {
      await fetch(`/api/vehicles/${vehicle.id}/passport/${tokenId}`, {
        method: "DELETE",
      })
      window.location.reload()
    } catch {}
  }

  async function handleCopy(token: string) {
    try {
      const url = `${window.location.origin}/p/${token}`
      await navigator.clipboard.writeText(url)
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {}
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/app/vehicles" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-4" />
          Araçlar
        </Link>
        <span className="mx-1">/</span>
        <Link href={`/app/vehicles/${vehicle.id}`} className="hover:text-foreground font-medium truncate">
          {vehicle.plate}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-foreground font-medium">Servis Pasaportu</span>
      </div>

      {/* Vehicle Header */}
      <header className="rounded-lg border border-border bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-lg bg-navy flex items-center justify-center text-white shrink-0">
              <Car className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <PlateBadge plate={vehicle.plate} className="h-8 min-w-[6rem] text-sm" />
                <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {vehicle.brand} {vehicle.model}
                </h2>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                {vehicle.vehicleType ? <span>{vehicle.vehicleType}</span> : null}
                {vehicle.modelYear ? <span>{vehicle.modelYear}</span> : null}
                {vehicle.color ? <span>{vehicle.color}</span> : null}
                {vehicle.mileage ? <span>{formatMileage(vehicle.mileage)}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={`/app/vehicles/${vehicle.id}`} />}
            >
              Araç Detayı
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Service History Timeline */}
          <SectionCard title="Servis Geçmişi" icon={Clock} count={allTimelineEvents.length}>
            {allTimelineEvents.length === 0 ? (
              <EmptyState icon={Clock} text="Henüz servis geçmişi yok" />
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
                {allTimelineEvents.slice(0, 20).map((e, idx) => (
                  <div key={`${e.intakeId}-${idx}`} className="flex items-start gap-3 px-4 sm:px-5 py-2.5">
                    <div className="size-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{e.description}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{formatDateTime(e.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Work Order History */}
          <SectionCard title="İş Emri Geçmişi" icon={Wrench} count={workOrders.length}>
            {workOrders.length === 0 ? (
              <EmptyState icon={Wrench} text="İş emri bulunmuyor" />
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
                {workOrders.map((i) =>
                  i.order ? (
                    <Link
                      key={i.order.id}
                      href={`/app/orders/${i.order.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {i.order.workOrderNo || "—"}
                          </span>
                          <StatusBadge status={i.order.status} />
                          <PaymentStatusBadge status={i.order.paymentStatus} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{i.customerComplaint}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {i.order.grandTotal > 0 ? formatTRY(i.order.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(i.createdAt)}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/70 shrink-0" />
                    </Link>
                  ) : null
                )}
              </div>
            )}
          </SectionCard>

          {/* Damage History */}
          <SectionCard title="Hasar Geçmişi" icon={AlertTriangle} count={allDamageMarks.length}>
            {allDamageMarks.length === 0 ? (
              <EmptyState icon={AlertTriangle} text="Hasar kaydı bulunmuyor" />
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
                {allDamageMarks.map((dm) => {
                  const dt = DAMAGE_TYPES[dm.damageType as keyof typeof DAMAGE_TYPES]
                  const sev = DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]
                  return (
                    <div key={dm.id} className="px-4 sm:px-5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{dm.zone}</span>
                            <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: dt?.color || "#6B7280" }}>
                              {dt?.label || dm.damageType}
                            </span>
                            <span className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: sev?.color || "#9CA3AF" }}>
                              {sev?.label || dm.severity}
                            </span>
                          </div>
                          {dm.note ? <p className="text-xs text-muted-foreground mt-0.5">{dm.note}</p> : null}
                        </div>
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">{formatDate(dm.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Photo History */}
          <SectionCard title="Fotoğraf Geçmişi" icon={Camera} count={allPhotos.length}>
            {allPhotos.length === 0 ? (
              <EmptyState icon={Camera} text="Fotoğraf bulunmuyor" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allPhotos.map((p) => {
                  const pt = PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]
                  return (
                    <div key={p.id} className="block rounded-lg border border-border overflow-hidden">
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        {p.fileUrl ? (
                          <Image src={p.fileUrl} alt={p.label || pt?.label || "Fotoğraf"} width={160} height={120} unoptimized className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="size-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-medium text-foreground truncate">{pt?.label || p.label || p.type}</p>
                        <p className="text-[10px] text-muted-foreground/70">{formatDate(p.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Maintenance Reminders */}
          <SectionCard title="Bakım Hatırlatmaları" icon={BellRing} count={reminders.length}>
            {reminders.length === 0 ? (
              <EmptyState icon={BellRing} text="Bakım hatırlatması bulunmuyor" />
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
                {reminders.map((r) => (
                  <Link key={r.id} href={`/app/reminders/${r.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{r.title}</span>
                        <ReminderStatusBadge status={r.status} />
                        <ReminderTypeBadge type={r.type} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {r.dueDate ? (
                          <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{formatDate(r.dueDate)}</span>
                        ) : null}
                        {r.dueMileage ? (
                          <span className="inline-flex items-center gap-1"><Gauge className="size-3" />{r.dueMileage.toLocaleString("tr-TR")} km</span>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/70 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-5">
          {/* Customer Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <User className="size-4 text-muted-foreground" />
                Müşteri
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href={`/app/customers/${customer.id}`} className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -m-2 transition-colors">
                <div className="size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{customerDisplayName(customer)}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="inline-flex items-center gap-1"><Phone className="size-3" />{customer.phone}</span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/70 shrink-0 ml-auto" />
              </Link>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-muted-foreground" />
                Özet
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <QuickStat label="Toplam Kabul" value={`${intakes.length}`} />
              <QuickStat label="İş Emri" value={`${workOrders.length}`} />
              <QuickStat label="Hasar Kaydı" value={`${allDamageMarks.length}`} />
              <QuickStat label="Fotoğraf" value={`${allPhotos.length}`} />
              <QuickStat label="Hatırlatma" value={`${reminders.length}`} />
            </CardContent>
          </Card>

          {/* Share & QR Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Share2 className="size-4 text-muted-foreground" />
                Paylaşım & QR Kod
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {tokens.length > 0 && (
                <div className="space-y-3">
                  {tokens.map((t) => (
                    <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t.label || "Pasaport Linki"}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 font-mono truncate mt-0.5">
                            /p/{t.token.slice(0, 16)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggle(t.id, t.isActive)}
                                disabled={toggling === t.id}
                              />
                            }>
                              {t.isActive ? (
                                <ToggleRight className="size-5 text-success" />
                              ) : (
                                <ToggleLeft className="size-5 text-muted-foreground/70" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top">{t.isActive ? "Deaktif et" : "Aktif et"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(t.id)}
                              />
                            }>
                              <Trash2 className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent side="top">Sil</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {t.showWorkOrders && <VisibilityBadge label="İş Emirleri" />}
                        {t.showDamages && <VisibilityBadge label="Hasarlar" />}
                        {t.showPhotos && <VisibilityBadge label="Fotoğraflar" />}
                        {t.showReminders && <VisibilityBadge label="Hatırlatmalar" />}
                        {t.showServiceHistory && <VisibilityBadge label="Zaman Çizelgesi" />}
                        {t.showPaymentStatus && <VisibilityBadge label="Ödeme" />}
                      </div>

                      {t.expiresAt && (
                        <p className="text-[11px] text-warning">
                          Son kullanma: {formatDate(t.expiresAt)}
                          {new Date(t.expiresAt) < new Date() ? " (Süresi dolmuş)" : ""}
                        </p>
                      )}

                      {t.isActive && (!t.expiresAt || new Date(t.expiresAt) > new Date()) && (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopy(t.token)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-foreground hover:bg-muted text-xs font-medium transition-colors"
                            >
                              {copied === t.token ? <CheckCircle2 className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                              {copied === t.token ? "Kopyalandı!" : "Linki Kopyala"}
                            </button>
                            <Button
                              nativeButton={false}
                              variant="outline"
                              render={<Link href={`/p/${t.token}`} target="_blank" />}
                            >
                              <ExternalLink className="size-3.5" />
                              Önizle
                            </Button>
                          </div>
                          <div className="flex justify-center mt-2">
                            <PassportQRCode url={`${typeof window !== "undefined" ? window.location.origin : ""}/p/${t.token}`} size={160} />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 transition-colors"
                >
                  <Plus className="size-4" />
                  Yeni Pasaport Linki Oluştur
                </button>
              ) : (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Etiket (opsiyonel)</label>
                    <Input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="örn: Müşteri paylaşımı"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Son kullanma tarihi (opsiyonel)</label>
                    <Input
                      type="date"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Görünürlük</p>
                    <div className="space-y-1.5">
                      <VisibilityToggle label="Zaman Çizelgesi" checked={newVisibility.showServiceHistory} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showServiceHistory: v }))} />
                      <VisibilityToggle label="İş Emirleri" checked={newVisibility.showWorkOrders} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showWorkOrders: v }))} />
                      <VisibilityToggle label="Hasarlar" checked={newVisibility.showDamages} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showDamages: v }))} />
                      <VisibilityToggle label="Fotoğraflar" checked={newVisibility.showPhotos} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showPhotos: v }))} />
                      <VisibilityToggle label="Hatırlatmalar" checked={newVisibility.showReminders} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showReminders: v }))} />
                      <VisibilityToggle label="Ödeme Durumu" checked={newVisibility.showPaymentStatus} onChange={(v) => setNewVisibility((prev) => ({ ...prev, showPaymentStatus: v }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating}
                      className="flex-1 h-9 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 transition-colors disabled:opacity-50"
                    >
                      {creating ? "Oluşturuluyor..." : "Oluştur"}
                    </button>
                    <button
                      onClick={() => { setShowCreateForm(false); setNewLabel(""); setNewExpiry(""); }}
                      className="h-9 px-4 rounded-lg border border-border bg-white text-foreground text-sm font-medium hover:bg-muted transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
          {typeof count === "number" ? <span className="text-xs text-muted-foreground font-normal">({count})</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground">
      <Icon className="size-8 mx-auto mb-2 text-muted-foreground/50" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const info = ORDER_STATUS[status as keyof typeof ORDER_STATUS]
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border ${info?.color || "bg-muted text-foreground border-border"}`}>
      {info?.label || status}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const info = PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS]
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border ${info?.color || "bg-muted text-muted-foreground border-border"}`}>
      {info?.label || status}
    </span>
  )
}

function ReminderStatusBadge({ status }: { status: string }) {
  const info = MAINTENANCE_REMINDER_STATUS[status as keyof typeof MAINTENANCE_REMINDER_STATUS]
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border ${info?.color || "bg-muted text-foreground border-border"}`}>
      {info?.label || status}
    </span>
  )
}

function ReminderTypeBadge({ type }: { type: string }) {
  const info = MAINTENANCE_REMINDER_TYPES[type as keyof typeof MAINTENANCE_REMINDER_TYPES]
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
      {info?.label || type}
    </span>
  )
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  )
}

function VisibilityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
      {label}
    </span>
  )
}

function VisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c)}
      />
    </label>
  )
}