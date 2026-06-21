"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Car,
  Phone,
  MapPin,
  Star,
  Shield,
  Printer,
  Share2,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Camera,
  BellRing,
  Clock,
  Gauge,
  Calendar,
} from "lucide-react"
import { ORDER_STATUS, PAYMENT_STATUS, MAINTENANCE_REMINDER_STATUS } from "@/lib/constants"
import { formatTRY, formatMileage } from "@/lib/format"
import { generatePassportWhatsAppText } from "@/lib/passport/data-safety"
import { BrandLogo } from "@/components/shared/brand-logo"

type SafePassportVehicle = {
  plate: string
  brand: string
  model: string
  modelYear: number | null
  mileage: number | null
  vin: string | null
  vehicleType: string | null
  color: string | null
  fuelType: string | null
  transmission: string | null
}

type SafePassportCustomer = {
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  contactName: string | null
  type: string
  phone: string
}

type SafePassportTimelineEvent = {
  eventType: string
  description: string
  createdAt: string
}

type SafePassportWorkOrder = {
  workOrderNo: string | null
  status: string
  statusLabel: string
  paymentStatus: string | null
  paymentStatusLabel: string | null
  customerComplaint: string
  createdAt: string
  items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[]
  grandTotal: number | null
}

type SafePassportDamageMark = {
  zone: string
  zoneLabel: string
  damageType: string
  damageTypeLabel: string
  severity: string
  severityLabel: string
  severityColor: string
  note: string | null
  createdAt: string
}

type SafePassportPhoto = {
  id: string
  type: string
  label: string
  fileUrl: string | null
  phase: string
  createdAt: string
}

type SafePassportReminder = {
  title: string
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  dueDate: string | null
  dueMileage: number | null
  lastServiceDate: string | null
  lastServiceMileage: number | null
  customerNote: string | null
  completedAt: string | null
}

type SafePassportData = {
  vehicle: SafePassportVehicle
  customer: SafePassportCustomer
  serviceHistory: SafePassportTimelineEvent[]
  workOrders: SafePassportWorkOrder[]
  damageHistory: SafePassportDamageMark[]
  photoHistory: SafePassportPhoto[]
  reminders: SafePassportReminder[]
}

type PassportTokenInfo = {
  token: string
  label: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  showServiceHistory: boolean
  showWorkOrders: boolean
  showDamages: boolean
  showPhotos: boolean
  showReminders: boolean
  showPaymentStatus: boolean
  workshop: {
    name: string
    phone: string
    city: string
    address: string
    logoUrl: string | null
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR")
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function PublicVehiclePassportPage({
  data,
  passportToken,
}: {
  data: SafePassportData
  passportToken: PassportTokenInfo
}) {
  const { vehicle, customer, serviceHistory, workOrders, damageHistory, photoHistory, reminders } = data
  const { workshop } = passportToken
  const [copied, setCopied] = useState(false)

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/p/${passportToken.token}` : `/p/${passportToken.token}`

  function handlePrint() {
    window.print()
  }

  function handleWhatsAppShare() {
    const text = generatePassportWhatsAppText({
      publicLink,
      workshopName: workshop.name,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
    })
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const vehicleLabel = `${vehicle.brand} ${vehicle.model}${vehicle.modelYear ? ` ${vehicle.modelYear}` : ""}`
  const customerName = customer.type === "corporate"
    ? customer.companyName || customer.contactName || "Kurumsal Müşteri"
    : customer.fullName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Müşteri"

  const totalOrders = workOrders.length
  const completedOrders = workOrders.filter((wo) => wo.status === "delivered").length
  const totalSpent = workOrders.reduce((sum, wo) => sum + (wo.grandTotal ?? 0), 0)

  return (
    <div className="min-h-screen bg-muted print:bg-white print:text-black">
      {/* Header */}
      <header className="bg-navy text-white p-5 print:hidden">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {workshop.logoUrl && (
                <Image src={workshop.logoUrl} alt={workshop.name} width={40} height={40} className="rounded-lg object-cover" unoptimized />
              )}
              <div>
                <h1 className="font-bold text-lg">{workshop.name}</h1>
                <p className="text-sm text-white/70">Dijital Servis Pasaportu</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/50">
              <Shield className="size-4" />
              <span className="text-xs">Güvenli Bağlantı</span>
            </div>
          </div>
        </div>
      </header>

      {/* Print Header */}
      <div className="hidden print:block p-6 border-b-[3px] border-border">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{workshop.name}</h1>
              <p className="text-sm text-muted-foreground">Dijital Servis Pasaportu</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{fmtDate(passportToken.createdAt)}</p>
              <p className="text-xs italic">BakimX ile oluşturuldu</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 print:p-6 space-y-4 print:space-y-3 print:text-sm">
        {/* Vehicle & Customer */}
        <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-lg bg-navy flex items-center justify-center text-white shrink-0">
              <Car className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{vehicle.plate}</h2>
              <p className="text-sm text-muted-foreground">{vehicleLabel}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                {vehicle.vehicleType && <span>{vehicle.vehicleType}</span>}
                {vehicle.color && <span>{vehicle.color}</span>}
                {vehicle.fuelType && <span>{vehicle.fuelType}</span>}
                {vehicle.transmission && <span>{vehicle.transmission}</span>}
                {vehicle.mileage && <span>{formatMileage(vehicle.mileage)}</span>}
                {vehicle.vin && <span className="font-mono">VIN: {vehicle.vin}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-3.5 text-muted-foreground/70" />
              <span className="font-medium text-foreground">{customerName}</span>
              <span className="text-muted-foreground/70">•</span>
              <span className="text-muted-foreground">{customer.phone}</span>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
            <Star className="size-4" />
            Servis Özeti
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{totalOrders}</p>
              <p className="text-[11px] text-muted-foreground">İş Emri</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{completedOrders}</p>
              <p className="text-[11px] text-muted-foreground">Tamamlanan</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{damageHistory.length}</p>
              <p className="text-[11px] text-muted-foreground">Hasar</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{photoHistory.length}</p>
              <p className="text-[11px] text-muted-foreground">Fotoğraf</p>
            </div>
          </div>
          {totalSpent > 0 && passportToken.showPaymentStatus && (
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Toplam Harcama</span>
              <span className="font-bold text-foreground">{formatTRY(totalSpent)}</span>
            </div>
          )}
        </div>

        {/* Work Orders */}
        {passportToken.showWorkOrders && workOrders.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <Wrench className="size-4" />
              İş Emirleri ({workOrders.length})
            </h3>
            <div className="space-y-3">
              {workOrders.map((wo, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {wo.workOrderNo && <span className="font-mono text-xs font-semibold text-muted-foreground">{wo.workOrderNo}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS[wo.status as keyof typeof ORDER_STATUS]?.color || "bg-muted text-muted-foreground"}`}>
                        {wo.statusLabel}
                      </span>
                      {wo.paymentStatusLabel && passportToken.showPaymentStatus && wo.paymentStatus && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS[wo.paymentStatus as keyof typeof PAYMENT_STATUS]?.color || "bg-muted text-muted-foreground"}`}>
                          {wo.paymentStatusLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/70">{fmtDate(wo.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{wo.customerComplaint}</p>
                  {wo.items.length > 0 && (
                    <div className="space-y-1">
                      {wo.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>
                            <span className={`inline-block size-1.5 rounded-full mr-1.5 ${item.type === "part" ? "bg-primary" : "bg-primary/60"}`} />
                            {item.name} <span className="text-muted-foreground/70">×{item.quantity}</span>
                          </span>
                          {item.totalPrice != null && item.totalPrice > 0 ? (
                            <span className="font-medium">{formatTRY(item.totalPrice)}</span>
                          ) : item.unitPrice != null && item.unitPrice > 0 ? (
                            <span className="font-medium">{formatTRY(item.unitPrice * item.quantity)}</span>
                          ) : null}
                        </div>
                      ))}
                      {wo.grandTotal != null && wo.grandTotal > 0 && (
                        <div className="flex justify-between text-sm font-bold pt-1 border-t border-border mt-1">
                          <span>Toplam</span>
                          <span>{formatTRY(wo.grandTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Damage History */}
        {passportToken.showDamages && damageHistory.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4" />
              Hasar Kayıtları ({damageHistory.length})
            </h3>
            <div className="space-y-2">
              {damageHistory.map((dm, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm py-1.5 border-b border-border last:border-0">
                  <span className="w-3 h-3 rounded-full shrink-0 mt-0.5 print:border print:border-black" style={{ backgroundColor: dm.severityColor }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{dm.zoneLabel}</span>
                    <span className="text-muted-foreground"> — {dm.damageTypeLabel}</span>
                    <span className="text-xs ml-1 px-1.5 py-0.5 bg-muted rounded-full print:border print:border-border">{dm.severityLabel}</span>
                    {dm.note && <p className="text-muted-foreground/60 text-xs mt-0.5">{dm.note}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 shrink-0">{fmtDate(dm.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo History */}
        {passportToken.showPhotos && photoHistory.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <Camera className="size-4" />
              Fotoğraflar ({photoHistory.length})
            </h3>
            <div className="space-y-1.5">
              {photoHistory.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-3.5 text-success print:text-black shrink-0" />
                  <span>{p.label}</span>
                  <span className="text-xs text-muted-foreground/60 ml-auto">{fmtDate(p.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        {passportToken.showReminders && reminders.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <BellRing className="size-4" />
              Bakım Hatırlatmaları ({reminders.length})
            </h3>
            <div className="space-y-2">
              {reminders.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{r.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-foreground rounded-full border border-primary/20">{r.typeLabel}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${MAINTENANCE_REMINDER_STATUS[r.status as keyof typeof MAINTENANCE_REMINDER_STATUS]?.color || "bg-muted text-muted-foreground border-border"}`}>
                        {r.statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {r.dueDate && <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{fmtDate(r.dueDate)}</span>}
                      {r.dueMileage && <span className="inline-flex items-center gap-1"><Gauge className="size-3" />{r.dueMileage.toLocaleString("tr-TR")} km</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Timeline */}
        {passportToken.showServiceHistory && serviceHistory.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <Clock className="size-4" />
              Servis Zaman Çizelgesi
            </h3>
            <div className="space-y-2">
              {serviceHistory.map((e, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{e.description}</p>
                    <p className="text-xs text-muted-foreground/70">{fmtDateTime(e.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workshop Footer */}
        <div className="bg-card border border-border rounded-lg p-4 print:border print:border-border">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">İş Yeri Bilgileri</h3>
          <div className="text-sm space-y-1.5 mt-2">
            <div className="flex items-center gap-1.5 font-bold">
              <Star className="size-3.5 text-navy" />
              <span>{workshop.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              <span>{workshop.city}, {workshop.address}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3.5" />
              <span>{workshop.phone}</span>
            </div>
          </div>
        </div>

        {/* Data Safety Notice */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 print:border print:border-primary/30 text-center">
          <Shield className="size-4 text-primary/60 mx-auto mb-1.5 print:hidden" />
          <p className="text-xs text-foreground">
            Bu sayfa yalnızca yetkili kişilerle paylaşım içindir. İç notlar, OCR verileri ve iş yeri iç kimlik bilgileri bu sayfada gösterilmez.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-muted border border-border rounded-lg p-4 print:border print:border-border text-center">
          <p className="text-xs text-muted-foreground">
            Bu çıktı, araç dijital servis pasaportu amacıyla oluşturulmuştur.
          </p>
        </div>

        {/* Actions (screen only) */}
        <div className="print:hidden space-y-3 pt-2 pb-8">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 bg-navy text-white rounded-lg font-medium hover:bg-navy/90 transition-colors"
          >
            <Printer className="size-5" />
            Yazdır / PDF Olarak Kaydet
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-lg font-medium hover:bg-[#25D366]/90 transition-colors"
          >
            <Share2 className="size-5" />
            WhatsApp ile Paylaş
          </button>
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 border border-border bg-white text-muted-foreground rounded-lg font-medium hover:bg-muted transition-colors"
          >
            {copied ? <CheckCircle2 className="size-5 text-success" /> : <Share2 className="size-5" />}
            {copied ? "Kopyalandı!" : "Linki Kopyala"}
          </button>
          <p className="text-center text-xs text-muted-foreground/60 px-4">
            Bu sayfanın çıktısını alabilir veya PDF olarak kaydedebilirsiniz.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-4 border-t border-border print:border-border">
          <BrandLogo variant="icon-light" size="sm" alt="BakimX" />
          <span className="text-xs text-muted-foreground/60 print:text-muted-foreground">ile oluşturuldu</span>
          <span className="text-xs text-muted-foreground/40 print:text-muted-foreground/60">•</span>
          <span className="text-xs text-muted-foreground/60 print:text-muted-foreground">
            <span className="print:hidden">{fmtDate(passportToken.createdAt)}</span>
            <span className="hidden print:inline">{fmtDate(passportToken.createdAt)}</span>
          </span>
        </div>
      </main>
    </div>
  )
}