"use client"

import Image from "next/image"
import { Printer, Car, Phone, Mail, CheckCircle2, MapPin, Calendar, Shield, Star } from "lucide-react"
import { INTAKE_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { formatTRY } from "@/lib/format"

type ShareLink = {
  id: string
  token: string
  createdAt: Date
  workshop: {
    id: string
    name: string
    phone: string
    city: string
    address: string
    logoUrl: string | null
  }
  intakeForm: {
    id: string
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    internalNote: string | null
    approvedAt: Date | null
    createdAt: Date
    customer: { firstName: string; lastName: string; phone: string; email: string | null }
    vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
    photos: { id: string; type: string; label: string; fileUrl: string | null }[]
    damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
    approvals: { id: string; status: string; approvedAt: Date | null }[]
    order: { id: string; status: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[] } | null
  }
}

export function PublicSharePage({ shareLink }: { shareLink: ShareLink }) {
  const { workshop, intakeForm } = shareLink
  const statusInfo = INTAKE_STATUS[intakeForm.status as keyof typeof INTAKE_STATUS]

  function handlePrint() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] print:bg-white print:text-black">
      {/* Header */}
      <header className="bg-navy text-white p-5 print:hidden">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {workshop.logoUrl && (
                <Image src={workshop.logoUrl} alt={workshop.name} width={40} height={40} className="rounded-lg object-cover" />
              )}
              <div>
                <h1 className="font-bold text-lg">{workshop.name}</h1>
                <p className="text-sm text-white/70">Araç Kabul Formu</p>
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Yazdır / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Print header */}
      <div className="hidden print:block p-6 border-b-[3px] border-gray-300">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
              <p className="text-sm text-gray-500">Araç Kabul Formu</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{new Date(shareLink.createdAt).toLocaleDateString("tr-TR")}</p>
              <p className="text-xs italic">BakimX tarafından oluşturuldu</p>
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
        </div>

        {/* Customer + Vehicle Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Müşteri & Araç</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-bold text-base">{intakeForm.customer.firstName} {intakeForm.customer.lastName}</p>
              <div className="flex items-center gap-1.5 text-gray-500 mt-1">
                <Phone className="size-3" />
                <span>{intakeForm.customer.phone}</span>
              </div>
              {intakeForm.customer.email && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Mail className="size-3" />
                  <span>{intakeForm.customer.email}</span>
                </div>
              )}
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
                  Kilometre: {intakeForm.mileageAtIntake.toLocaleString("tr-TR")} km
                </p>
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
              <span>Kayıt: {new Date(intakeForm.createdAt).toLocaleDateString("tr-TR")}</span>
              {intakeForm.approvedAt && (
                <span>Onay: {new Date(intakeForm.approvedAt).toLocaleDateString("tr-TR")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Damage Summary */}
        {intakeForm.damageMarks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">
              Hasar Kayıtları ({intakeForm.damageMarks.length})
            </h3>
            <div className="space-y-2">
              {intakeForm.damageMarks.map((mark) => {
                const severityInfo = DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]
                return (
                  <div key={mark.id} className="flex items-start gap-2.5 text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5 print:border print:border-black"
                      style={{ backgroundColor: severityInfo?.color || "#9CA3AF" }}
                    />
                    <div>
                      <span className="font-medium">{VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone}</span>
                      <span className="text-gray-500"> — {DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType}</span>
                      <span className="text-xs ml-1 px-1.5 py-0.5 bg-gray-100 rounded-full print:border print:border-gray-300">
                        {severityInfo?.label || mark.severity}
                      </span>
                      {mark.note && <p className="text-gray-400 text-xs mt-0.5">{mark.note}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Photo Summary */}
        {intakeForm.photos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">
              Fotoğraf Kontrol Listesi ({intakeForm.photos.length})
            </h3>
            <div className="space-y-1.5">
              {intakeForm.photos.map((photo) => (
                <div key={photo.id} className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-green-500 print:text-black shrink-0" />
                  <span>{photo.label}</span>
                </div>
              ))}
            </div>
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
        {intakeForm.order && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Servis Emri</h3>
            {intakeForm.order.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Henüz kalem eklenmedi</p>
            ) : (
              <div className="space-y-2">
                {intakeForm.order.items.map((item) => {
                  const lineTotal = item.totalPrice || (item.unitPrice && item.unitPrice * item.quantity) || 0
                  return (
                    <div key={item.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-400 ml-2">×{item.quantity}</span>
                        <span className={`text-xs ml-1.5 ${item.type === "part" ? "text-blue-600" : "text-purple-600"}`}>
                          ({item.type === "part" ? "Parça" : "İşçilik"})
                        </span>
                      </div>
                      <span className="font-medium">{formatTRY(lineTotal)}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-bold">
                  <span>Toplam</span>
                  <span className="text-base">
                    {formatTRY(
                      intakeForm.order.items.reduce((sum, item) => {
                        if (item.totalPrice) return sum + item.totalPrice
                        if (item.unitPrice) return sum + item.unitPrice * item.quantity
                        return sum
                      }, 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workshop Footer */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 print:border print:border-gray-300 print:shadow-none space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">İş Yeri Bilgileri</h3>
          <div className="text-sm space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Star className="size-3.5 text-navy" />
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

        {/* Actions */}
        <div className="print:hidden space-y-4 pt-2 pb-8">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 bg-navy text-white rounded-xl font-medium hover:bg-navy/90 transition-colors"
          >
            <Printer className="size-5" />
            Yazdır / PDF Olarak Kaydet
          </button>
          <p className="text-center text-xs text-gray-400 px-4">
            Bu sayfanın çıktısını alabilir veya tarayıcınızın &quot;PDF olarak kaydet&quot; seçeneği ile PDF dosyası oluşturabilirsiniz. WhatsApp ile paylaşım için bu linki kullanabilirsiniz.
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
