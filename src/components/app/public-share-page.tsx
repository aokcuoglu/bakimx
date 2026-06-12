"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Printer, Car, Phone, CheckCircle2, MapPin, Calendar, Shield, Star, Share2, FileText, FileDown, Clock, BarChart3, Eye } from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"
import { formatTRY, formatMileage } from "@/lib/format"
import { generateWhatsAppShareText, getWhatsAppShareUrl } from "@/lib/share/whatsapp"
import { formatOrderSummary, formatLineTotal, calculateLineTotal } from "@/lib/totals"
import { ApprovalTimeline } from "@/components/app/approval-timeline"
import { GroupedPhotoGallery } from "@/components/app/grouped-photo-gallery"

type SafeIntakeData = {
  status: string
  statusLabel: string
  mileageAtIntake: number | null
  customerComplaint: string
  approvedAt: Date | null
  createdAt: Date
  customer: {
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    contactName: string | null
    type: string
    phone: string
  }
  vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string }[]
  damageMarks: { zone: string; zoneLabel: string; damageType: string; damageTypeLabel: string; severity: string; severityLabel: string; severityColor: string; note: string | null }[]
  approvals: { status: string; approvedAt: Date | null }[]
  order: { status: string; statusLabel: string; paymentStatusLabel: string; items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[] } | null
  timeline: { eventType: string; description: string; createdAt: Date }[]
}

type PhotoCompletionResult = {
  total: number
  completed: number
  required: number
  requiredCompleted: number
  percentage: number
  missing: string[]
  missingLabels: string[]
}

type PhotoPhaseGroup = {
  phase: string
  label: string
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string }[]
}

type ShareLink = {
  createdAt: Date
  token: string
  showPhotos: boolean
  showDamage: boolean
  showOrderItems: boolean
  showPaymentStatus: boolean
  showTimeline: boolean
  workshop: {
    name: string
    phone: string
    city: string
    address: string
    logoUrl: string | null
  }
  intakeForm: SafeIntakeData
  photoCompletion: PhotoCompletionResult
  photoGroups: PhotoPhaseGroup[]
}

export function PublicSharePage({ shareLink }: { shareLink: ShareLink }) {
  const { workshop, intakeForm, token, photoCompletion, photoGroups } = shareLink
  const statusInfo = INTAKE_STATUS[intakeForm.status as keyof typeof INTAKE_STATUS]
  const [copied, setCopied] = useState(false)

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : `/s/${token}`

  const orderItems = intakeForm.order?.items ?? []
  const summary = formatOrderSummary(orderItems)
  const parts = orderItems.filter((i) => i.type === "part")
  const labor = orderItems.filter((i) => i.type === "labor")

  function handlePrint() {
    window.print()
  }

  function handleWhatsAppShare() {
    const text = generateWhatsAppShareText({
      publicLink,
      workshopName: workshop.name,
      plate: intakeForm.vehicle.plate,
      statusLabel: intakeForm.statusLabel,
      totalAmount: intakeForm.order ? orderItems.reduce((sum, item) => {
        if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
        if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
        return sum
      }, 0) : null,
    })
    window.open(getWhatsAppShareUrl(text), "_blank")
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] print:bg-white print:text-black">
      {/* Screen header */}
      <header className="bg-[#0B1F3A] text-white p-5 print:hidden">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {workshop.logoUrl && (
                <Image src={workshop.logoUrl} alt={workshop.name} width={40} height={40} className="rounded-lg object-cover" unoptimized />
              )}
              <div>
                <h1 className="font-bold text-lg">{workshop.name}</h1>
                <p className="text-sm text-white/70">Araç Kabul ve İşlem Özeti</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/50">
              <Shield className="size-4" />
              <span className="text-xs">Güvenli Bağlantı</span>
            </div>
          </div>
        </div>
      </header>

      {/* Print header */}
      <div className="hidden print:block p-6 border-b-[3px] border-gray-300">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
              <p className="text-sm text-gray-500">Araç Kabul ve İşlem Özeti</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{new Date(intakeForm.createdAt).toLocaleDateString("tr-TR")}</p>
              <p className="text-xs italic">BakimX ile oluşturuldu</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 print:p-6 space-y-4 print:space-y-3 print:text-sm">
        {/* Status banner */}
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-lg font-semibold">Araç Kabul Detayı</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
            {statusInfo?.label || intakeForm.status}
          </span>
        </div>

        <div className="hidden print:flex print:items-center print:justify-between">
          <span className="text-xs px-2 py-1 rounded-full border border-gray-400 font-medium">
            Durum: {statusInfo?.label || intakeForm.status}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(intakeForm.createdAt).toLocaleDateString("tr-TR")}
          </span>
        </div>

        {/* Evidence Summary Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2 mb-3">
            <BarChart3 className="size-4" />
            Kanıt Özeti
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className={`text-xl font-bold ${photoCompletion.percentage === 100 ? "text-emerald-600" : photoCompletion.percentage >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                {photoCompletion.percentage}%
              </p>
              <p className="text-xs text-gray-500">Fotoğraf</p>
            </div>
            <div className="text-center">
              <p className={`text-xl font-bold ${intakeForm.damageMarks.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {intakeForm.damageMarks.length}
              </p>
              <p className="text-xs text-gray-500">Hasar</p>
            </div>
            <div className="text-center">
              <p className={`text-xl font-bold ${intakeForm.approvals.length > 0 && intakeForm.approvals[0].status === "verified" ? "text-emerald-600" : "text-amber-600"}`}>
                {intakeForm.approvals.length > 0 && intakeForm.approvals[0].status === "verified" ? "Onaylı" : "Bekliyor"}
              </p>
              <p className="text-xs text-gray-500">Onay</p>
            </div>
          </div>
          <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${photoCompletion.percentage === 100 ? "bg-emerald-500" : photoCompletion.percentage >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${photoCompletion.percentage}%` }}
            />
          </div>
          {photoCompletion.missingLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {photoCompletion.missingLabels.map((label) => (
                <span key={label} className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-200">
                  Eksik: {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Customer & Vehicle */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Müşteri & Araç</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-bold text-base">
                {intakeForm.customer.type === "corporate"
                  ? intakeForm.customer.companyName || "Kurumsal Müşteri"
                  : intakeForm.customer.fullName || `${intakeForm.customer.firstName ?? ""} ${intakeForm.customer.lastName ?? ""}`.trim() || "Müşteri"}
              </p>
              <div className="flex items-center gap-1.5 text-gray-500 mt-1">
                <Phone className="size-3" />
                <span>{intakeForm.customer.phone}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-base">
                <Car className="size-4" />
                <span>{intakeForm.vehicle.plate}</span>
              </div>
              <p className="text-gray-500 mt-1">
                {intakeForm.vehicle.brand} {intakeForm.vehicle.model}
                {intakeForm.vehicle.modelYear && ` • ${intakeForm.vehicle.modelYear}`}
              </p>
              {intakeForm.mileageAtIntake != null && (
                <p className="text-gray-500">
                  Kilometre: {formatMileage(intakeForm.mileageAtIntake)}
                </p>
              )}
              {intakeForm.vehicle.vin && (
                <p className="text-gray-400 text-xs font-mono mt-0.5">VIN: {intakeForm.vehicle.vin}</p>
              )}
            </div>
          </div>
        </div>

        {/* Intake Details */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Kabul Detayı</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-700">Müşteri Şikayeti:</span>
              <p className="mt-1 text-gray-600 whitespace-pre-wrap">{intakeForm.customerComplaint}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
              <span className="flex items-center gap-1"><Calendar className="size-3" /> Kayıt: {new Date(intakeForm.createdAt).toLocaleDateString("tr-TR")}</span>
              {intakeForm.approvedAt && (
                <span className="flex items-center gap-1"><CheckCircle2 className="size-3" /> Onay: {new Date(intakeForm.approvedAt).toLocaleDateString("tr-TR")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Photos - Grouped by Phase */}
        {shareLink.showPhotos && intakeForm.photos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Eye className="size-3.5" />
              Fotoğraflar ({intakeForm.photos.length})
            </h3>
            <GroupedPhotoGallery groups={photoGroups} token={token} compact />
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              {intakeForm.photos.map((photo, idx) => (
                <div key={`${photo.type}-${idx}`} className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-green-500 print:text-black shrink-0" />
                  <span>{photo.label}</span>
                  {photo.fileUrl ? (
                    <span className="text-xs text-green-600 print:text-gray-600">(Fotoğraf mevcut)</span>
                  ) : (
                    <span className="text-xs text-gray-400">(Kaydedildi)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Damage Summary */}
        {shareLink.showDamage && intakeForm.damageMarks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">
              Hasar Kayıtları ({intakeForm.damageMarks.length})
            </h3>
            <div className="space-y-2">
              {intakeForm.damageMarks.map((mark, idx) => (
                <div key={`dm-${idx}-${mark.zone}`} className="flex items-start gap-2.5 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-0.5 print:border print:border-black"
                    style={{ backgroundColor: mark.severityColor }}
                  />
                  <div>
                    <span className="font-medium">{mark.zoneLabel}</span>
                    <span className="text-gray-500"> — {mark.damageTypeLabel}</span>
                    <span className="text-xs ml-1 px-1.5 py-0.5 bg-gray-100 rounded-full print:border print:border-gray-300">
                      {mark.severityLabel}
                    </span>
                    {mark.note && <p className="text-gray-400 text-xs mt-0.5">{mark.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval Timeline */}
        {shareLink.showTimeline && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2">
              <Clock className="size-3.5" />
              Onay Zaman Çizelgesi
            </h3>
            <ApprovalTimeline
              events={intakeForm.timeline}
              intakeCreatedAt={intakeForm.createdAt}
              approvedAt={intakeForm.approvedAt}
              compact
            />
          </div>
        )}

        {/* Approval Status */}
        {intakeForm.approvals.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Onay Durumu</h3>
            <div>
              {intakeForm.approvals[0].status === "verified" ? (
                <div className="flex items-center gap-2 text-green-700 print:text-black">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <span className="font-bold">Müşteri onayı verildi</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 print:text-black">
                  <Shield className="size-5 shrink-0" />
                  <span>Onay bekliyor</span>
                </div>
              )}
              {intakeForm.approvals[0].approvedAt && (
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <Calendar className="size-3" />
                  {new Date(intakeForm.approvals[0].approvedAt).toLocaleDateString("tr-TR")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Service Order */}
        {shareLink.showOrderItems && intakeForm.order && orderItems.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Servis Emri</h3>
            <div className="space-y-3">
              {parts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1.5">Parçalar ({summary.partsCount})</p>
                  <div className="space-y-1.5">
                    {parts.map((item, idx) => (
                      <div key={`part-${idx}`} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-400 ml-1.5">×{item.quantity}</span>
                          {item.unitPrice != null && item.unitPrice > 0 && (
                            <span className="text-gray-400 text-xs ml-1">({formatTRY(item.unitPrice)}/adet)</span>
                          )}
                        </div>
                        <span className={`font-medium ${calculateLineTotal(item) == null ? "text-gray-400 italic text-xs" : ""}`}>
                          {formatLineTotal(item)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {labor.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1.5">İşçilik ({summary.laborCount})</p>
                  <div className="space-y-1.5">
                    {labor.map((item, idx) => (
                      <div key={`labor-${idx}`} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-400 ml-1.5">×{item.quantity}</span>
                          {item.unitPrice != null && item.unitPrice > 0 && (
                            <span className="text-gray-400 text-xs ml-1">({formatTRY(item.unitPrice)}/birim)</span>
                          )}
                        </div>
                        <span className={`font-medium ${calculateLineTotal(item) == null ? "text-gray-400 italic text-xs" : ""}`}>
                          {formatLineTotal(item)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.hasAnyPrice && (
                <div className="border-t border-gray-200 pt-2 space-y-1 text-sm">
                  {parts.length > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Parça Toplamı</span>
                      <span>{summary.partsTotal}</span>
                    </div>
                  )}
                  {labor.length > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>İşçilik Toplamı</span>
                      <span>{summary.laborTotal}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
                    <span>Genel Toplam</span>
                    <span>{summary.grandTotal}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment status summary */}
            {shareLink.showPaymentStatus && intakeForm.order.paymentStatusLabel && (
              <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                Ödeme durumu: {intakeForm.order.paymentStatusLabel}
              </div>
            )}
          </div>
        )}

        {/* Workshop Footer */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">İş Yeri Bilgileri</h3>
          <div className="text-sm space-y-1.5">
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

        {/* Data safety notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 print:border print:border-blue-200 text-center">
          <Shield className="size-4 text-blue-400 mx-auto mb-1.5 print:hidden" />
          <p className="text-xs text-blue-600">
            Bu sayfa yalnızca yetkili kişilerle paylaşım içindir. İç notlar, OCR verileri ve iş yeri iç kimlik bilgileri bu sayfada gösterilmez.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 print:border print:border-gray-200 text-center">
          <FileText className="size-4 text-gray-400 mx-auto mb-1.5 print:hidden" />
          <p className="text-xs text-gray-500">
            Bu çıktı, servis kabul ve işlem özeti amacıyla oluşturulmuştur.
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
          <Link
            href={`/s/${token}/pdf`}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#2563EB]/90 transition-colors"
          >
            <FileDown className="size-5" />
            Yazdırılabilir Sayfa
          </Link>
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
            Bu sayfanın çıktısını alabilir, yazdırılabilir sayfayı açarak PDF olarak kaydedebilir veya WhatsApp ile paylaşabilirsiniz.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-300 print:text-gray-500 py-4">
          <p>BakimX ile oluşturuldu • <span className="print:hidden">{new Date(shareLink.createdAt).toLocaleDateString("tr-TR")}</span></p>
          <p className="print:hidden mt-1">www.bakimx.com</p>
        </div>
      </main>
    </div>
  )
}