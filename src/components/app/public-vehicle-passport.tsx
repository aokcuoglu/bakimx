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
    <div className="min-h-screen bg-[#F8FAFC] print:bg-white print:text-black">
      {/* Header */}
      <header className="bg-[#0B1F3A] text-white p-5 print:hidden">
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
      <div className="hidden print:block p-6 border-b-[3px] border-gray-300">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
              <p className="text-sm text-gray-500">Dijital Servis Pasaportu</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{fmtDate(passportToken.createdAt)}</p>
              <p className="text-xs italic">BakimX ile oluşturuldu</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 print:p-6 space-y-4 print:space-y-3 print:text-sm">
        {/* Vehicle & Customer */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-[#0B1F3A] flex items-center justify-center text-white shrink-0">
              <Car className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{vehicle.plate}</h2>
              <p className="text-sm text-slate-600">{vehicleLabel}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                {vehicle.vehicleType && <span>{vehicle.vehicleType}</span>}
                {vehicle.color && <span>{vehicle.color}</span>}
                {vehicle.fuelType && <span>{vehicle.fuelType}</span>}
                {vehicle.transmission && <span>{vehicle.transmission}</span>}
                {vehicle.mileage && <span>{formatMileage(vehicle.mileage)}</span>}
                {vehicle.vin && <span className="font-mono">VIN: {vehicle.vin}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{customerName}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{customer.phone}</span>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
            <Star className="size-4" />
            Servis Özeti
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-blue-600">{totalOrders}</p>
              <p className="text-[11px] text-gray-500">İş Emri</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{completedOrders}</p>
              <p className="text-[11px] text-gray-500">Tamamlanan</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{damageHistory.length}</p>
              <p className="text-[11px] text-gray-500">Hasar</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-purple-600">{photoHistory.length}</p>
              <p className="text-[11px] text-gray-500">Fotoğraf</p>
            </div>
          </div>
          {totalSpent > 0 && passportToken.showPaymentStatus && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-slate-500">Toplam Harcama</span>
              <span className="font-bold text-slate-900">{formatTRY(totalSpent)}</span>
            </div>
          )}
        </div>

        {/* Work Orders */}
        {passportToken.showWorkOrders && workOrders.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
              <Wrench className="size-4" />
              İş Emirleri ({workOrders.length})
            </h3>
            <div className="space-y-3">
              {workOrders.map((wo, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {wo.workOrderNo && <span className="font-mono text-xs font-semibold text-slate-500">{wo.workOrderNo}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS[wo.status as keyof typeof ORDER_STATUS]?.color || "bg-gray-100 text-gray-800"}`}>
                        {wo.statusLabel}
                      </span>
                      {wo.paymentStatusLabel && passportToken.showPaymentStatus && wo.paymentStatus && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS[wo.paymentStatus as keyof typeof PAYMENT_STATUS]?.color || "bg-slate-50 text-slate-500"}`}>
                          {wo.paymentStatusLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{fmtDate(wo.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{wo.customerComplaint}</p>
                  {wo.items.length > 0 && (
                    <div className="space-y-1">
                      {wo.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>
                            <span className={`inline-block size-1.5 rounded-full mr-1.5 ${item.type === "part" ? "bg-blue-500" : "bg-purple-500"}`} />
                            {item.name} <span className="text-slate-400">×{item.quantity}</span>
                          </span>
                          {item.totalPrice != null && item.totalPrice > 0 ? (
                            <span className="font-medium">{formatTRY(item.totalPrice)}</span>
                          ) : item.unitPrice != null && item.unitPrice > 0 ? (
                            <span className="font-medium">{formatTRY(item.unitPrice * item.quantity)}</span>
                          ) : null}
                        </div>
                      ))}
                      {wo.grandTotal != null && wo.grandTotal > 0 && (
                        <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-100 mt-1">
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
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4" />
              Hasar Kayıtları ({damageHistory.length})
            </h3>
            <div className="space-y-2">
              {damageHistory.map((dm, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="w-3 h-3 rounded-full shrink-0 mt-0.5 print:border print:border-black" style={{ backgroundColor: dm.severityColor }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{dm.zoneLabel}</span>
                    <span className="text-gray-500"> — {dm.damageTypeLabel}</span>
                    <span className="text-xs ml-1 px-1.5 py-0.5 bg-gray-100 rounded-full print:border print:border-gray-300">{dm.severityLabel}</span>
                    {dm.note && <p className="text-gray-400 text-xs mt-0.5">{dm.note}</p>}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">{fmtDate(dm.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo History */}
        {passportToken.showPhotos && photoHistory.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
              <Camera className="size-4" />
              Fotoğraflar ({photoHistory.length})
            </h3>
            <div className="space-y-1.5">
              {photoHistory.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-3.5 text-green-500 print:text-black shrink-0" />
                  <span>{p.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{fmtDate(p.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        {passportToken.showReminders && reminders.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
              <BellRing className="size-4" />
              Bakım Hatırlatmaları ({reminders.length})
            </h3>
            <div className="space-y-2">
              {reminders.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{r.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">{r.typeLabel}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${MAINTENANCE_REMINDER_STATUS[r.status as keyof typeof MAINTENANCE_REMINDER_STATUS]?.color || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {r.statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
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
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
              <Clock className="size-4" />
              Servis Zaman Çizelgesi
            </h3>
            <div className="space-y-2">
              {serviceHistory.map((e, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <div className="size-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700">{e.description}</p>
                    <p className="text-xs text-slate-400">{fmtDateTime(e.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workshop Footer */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">İş Yeri Bilgileri</h3>
          <div className="text-sm space-y-1.5 mt-2">
            <div className="flex items-center gap-1.5 font-bold">
              <Star className="size-3.5 text-[#0B1F3A]" />
              <span>{workshop.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="size-3.5" />
              <span>{workshop.city}, {workshop.address}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Phone className="size-3.5" />
              <span>{workshop.phone}</span>
            </div>
          </div>
        </div>

        {/* Data Safety Notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 print:border print:border-blue-200 text-center">
          <Shield className="size-4 text-blue-400 mx-auto mb-1.5 print:hidden" />
          <p className="text-xs text-blue-600">
            Bu sayfa yalnızca yetkili kişilerle paylaşım içindir. İç notlar, OCR verileri ve iş yeri iç kimlik bilgileri bu sayfada gösterilmez.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 print:border print:border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Bu çıktı, araç dijital servis pasaportu amacıyla oluşturulmuştur.
          </p>
        </div>

        {/* Actions (screen only) */}
        <div className="print:hidden space-y-3 pt-2 pb-8">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0B1F3A] text-white rounded-xl font-medium hover:bg-[#0B1F3A]/90 transition-colors"
          >
            <Printer className="size-5" />
            Yazdır / PDF Olarak Kaydet
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#25D366]/90 transition-colors"
          >
            <Share2 className="size-5" />
            WhatsApp ile Paylaş
          </button>
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            {copied ? <CheckCircle2 className="size-5 text-green-500" /> : <Share2 className="size-5" />}
            {copied ? "Kopyalandı!" : "Linki Kopyala"}
          </button>
          <p className="text-center text-xs text-gray-400 px-4">
            Bu sayfanın çıktısını alabilir veya PDF olarak kaydedebilirsiniz.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-300 print:text-gray-500 py-4">
          <p>BakimX ile oluşturuldu • <span className="print:hidden">{fmtDate(passportToken.createdAt)}</span></p>
          <p className="print:hidden mt-1">www.bakimx.com</p>
        </div>
      </main>
    </div>
  )
}