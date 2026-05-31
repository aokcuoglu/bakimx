"use client"

import Image from "next/image"
import { Car, Phone, Mail, CheckCircle2, MapPin, Calendar } from "lucide-react"
import { INTAKE_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-navy text-navy-foreground p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {workshop.logoUrl && <Image src={workshop.logoUrl} alt={workshop.name} width={40} height={40} className="rounded-lg object-cover" />}
            <div>
              <h1 className="font-bold text-lg">{workshop.name}</h1>
              <p className="text-sm text-white/70">Araç Kabul Formu</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Araç Kabul Detayı</h2>
          <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
            {statusInfo?.label || intakeForm.status}
          </span>
        </div>

        {/* Customer info */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">Müşteri</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span>{intakeForm.customer.firstName} {intakeForm.customer.lastName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3" />
              <span>{intakeForm.customer.phone}</span>
            </div>
            {intakeForm.customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3" />
                <span>{intakeForm.customer.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle info */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">Araç</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Car className="size-4" />
              <span>{intakeForm.vehicle.plate}</span>
            </div>
            <div className="text-muted-foreground">
              {intakeForm.vehicle.brand} {intakeForm.vehicle.model}
              {intakeForm.vehicle.modelYear && ` • ${intakeForm.vehicle.modelYear}`}
            </div>
            {intakeForm.mileageAtIntake && (
              <div className="text-muted-foreground">
                Kilometre: {intakeForm.mileageAtIntake.toLocaleString("tr-TR")} km
              </div>
            )}
            {intakeForm.vehicle.vin && intakeForm.vehicle.vin.length > 0 && (
              <div className="text-muted-foreground text-xs">
                VIN: {intakeForm.vehicle.vin}
              </div>
            )}
          </div>
        </div>

        {/* Complaint */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">Müşteri Şikayeti</h3>
          <p className="text-sm">{intakeForm.customerComplaint}</p>
        </div>

        {/* Damage summary */}
        {intakeForm.damageMarks.length > 0 && (
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Hasar Kayıtları ({intakeForm.damageMarks.length})</h3>
            <div className="space-y-2">
              {intakeForm.damageMarks.map((mark) => (
                <div key={mark.id} className="flex items-start gap-2 text-sm">
                  <span className="inline-block w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]?.color || "#9CA3AF" }} />
                  <div>
                    <span className="font-medium">{VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone}</span>
                    <span className="text-muted-foreground"> - {DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType}</span>
                    {mark.note && <span className="text-muted-foreground"> ({mark.note})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo checklist summary */}
        {intakeForm.photos.length > 0 && (
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Fotoğraflar ({intakeForm.photos.length})</h3>
            <div className="space-y-1">
              {intakeForm.photos.map((photo) => (
                <div key={photo.id} className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="size-3 text-green-500" />
                  <span>{photo.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval status */}
        {intakeForm.approvals.length > 0 && (
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Onay Durumu</h3>
            <div className="flex items-center gap-2">
              {intakeForm.approvals[0].status === "verified" ? (
                <>
                  <CheckCircle2 className="size-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">Onaylanmış</span>
                </>
              ) : (
                <span className="text-sm text-yellow-700">Onay bekliyor</span>
              )}
            </div>
            {intakeForm.approvals[0].approvedAt && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(intakeForm.approvals[0].approvedAt).toLocaleDateString("tr-TR")}
              </div>
            )}
          </div>
        )}

        {/* Service order */}
        {intakeForm.order && intakeForm.order.items.length > 0 && (
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">Servis Emri</h3>
            <div className="space-y-1">
              {intakeForm.order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                  </span>
                  {item.unitPrice && <span>{item.unitPrice.toLocaleString("tr-TR")} TL</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workshop footer */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">İş Yeri</h3>
          <div className="text-sm space-y-1">
            <div className="font-medium">{workshop.name}</div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" />
              <span>{workshop.city}, {workshop.address}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3" />
              <span>{workshop.phone}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground py-4">
          BakimX ile oluşturuldu • {new Date(shareLink.createdAt).toLocaleDateString("tr-TR")}
        </div>
      </main>
    </div>
  )
}