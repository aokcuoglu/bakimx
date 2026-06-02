"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppointmentStatusBadge } from "@/components/app/appointment-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import { APPOINTMENT_STATUS, type AppointmentStatusKey, REMINDER_STATUS } from "@/lib/constants"
import { customerDisplayName } from "@/lib/format"
import { formatDateTime } from "@/lib/utils-client"
import { cn } from "@/lib/utils"
import {
  updateAppointmentStatusAction,
  convertAppointmentToWorkOrderAction,
} from "@/app/app/appointments/actions"
import {
  ArrowLeft,
  CalendarClock,
  User,
  Car,
  Phone,
  FileText,
  Info,
  Loader2,
  Wrench,
  XCircle,
  Share2,
} from "lucide-react"
import { useFormStatus } from "react-dom"

type AppointmentDetailData = {
  id: string
  appointmentNo: string
  status: string
  appointmentAt: string
  estimatedDurationMinutes: number | null
  title: string | null
  customerRequest: string | null
  internalNote: string | null
  reminderStatus: string
  createdAt: string
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
  vehicle: {
    id: string
    plate: string
    brand: string
    model: string
  } | null
  convertedServiceOrder: { id: string; workOrderNo: string | null } | null
}

const ALLOWED_TRANSITIONS: Record<string, AppointmentStatusKey[]> = {
  scheduled: ["confirmed", "arrived", "cancelled", "no_show"],
  confirmed: ["arrived", "completed", "cancelled", "no_show"],
  arrived: ["completed", "converted", "no_show"],
  no_show: ["scheduled"],
}

function SubmitButton({ label, loading }: { label: string; loading?: boolean }) {
  const { pending } = useFormStatus()
  const isPending = pending || loading
  return (
    <Button type="submit" disabled={isPending} size="sm">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label}
    </Button>
  )
}

export function AppointmentDetail({
  appointment,
}: {
  appointment: AppointmentDetailData
}) {
  const router = useRouter()
  const [statusUpdateError, setStatusUpdateError] = useState("")
  const [convertError, setConvertError] = useState("")
  const [converting, setConverting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(appointment.status)

  const isConverted = appointment.status === "converted"
  const isCancelled = appointment.status === "cancelled"
  const isTerminal = isConverted || isCancelled
  const transitions = ALLOWED_TRANSITIONS[appointment.status] || []

  async function handleStatusUpdate(formData: FormData) {
    setStatusUpdateError("")
    setStatusUpdating(true)
    try {
      formData.set("appointmentId", appointment.id)
      const result = await updateAppointmentStatusAction(formData)
      if (result.success) {
        router.refresh()
      } else {
        setStatusUpdateError(result.error || "Durum güncellenemedi")
      }
    } catch {
      setStatusUpdateError("Bir hata oluştu")
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConvert() {
    setConvertError("")
    setConverting(true)
    try {
      const formData = new FormData()
      formData.set("appointmentId", appointment.id)
      const result = await convertAppointmentToWorkOrderAction(formData)
      if (result.success && result.orderId) {
        router.push(`/app/orders/${result.orderId}`)
      } else {
        setConvertError(result.error || "İş emrine çevrilemedi")
      }
    } catch {
      setConvertError("Bir hata oluştu")
    } finally {
      setConverting(false)
    }
  }

  const reminderInfo = REMINDER_STATUS[appointment.reminderStatus as keyof typeof REMINDER_STATUS]

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <button
          onClick={() => router.push("/app/appointments")}
          className="hover:text-slate-700 inline-flex items-center gap-1 touch-manipulation"
        >
          <ArrowLeft className="size-3.5" />
          Randevular
        </button>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{appointment.appointmentNo}</span>
      </div>

      {(statusUpdateError || convertError) && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{statusUpdateError || convertError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-slate-900">{appointment.appointmentNo}</span>
          <AppointmentStatusBadge status={appointment.status} size="md" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {appointment.title || "Randevu Detayı"}
        </h2>
        <p className="text-sm text-slate-500 flex items-center gap-1.5">
          <CalendarClock className="size-4" />
          {formatDateTime(appointment.appointmentAt)}
          {appointment.estimatedDurationMinutes && (
            <> • Yaklaşık {appointment.estimatedDurationMinutes} dk</>
          )}
        </p>
      </div>

      {!isTerminal && transitions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <form action={handleStatusUpdate} className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-40">
                <Label htmlFor="status-select" className="text-xs mb-1 block">Durumu Güncelle</Label>
                <select
                  id="status-select"
                  name="status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  {transitions.map((key) => {
                    const info = APPOINTMENT_STATUS[key]
                    return (
                      <option key={key} value={key}>
                        {info?.label || key}
                      </option>
                    )
                  })}
                </select>
              </div>
              <SubmitButton label="Güncelle" loading={statusUpdating} />
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="size-4 text-slate-500" />
                Müşteri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {customerDisplayName(appointment.customer)}
                  </p>
                  <a
                    href={`tel:${appointment.customer.phone}`}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 mt-1"
                  >
                    <Phone className="size-3.5" />
                    {appointment.customer.phone}
                  </a>
                </div>
                <Link
                  href={`/app/customers/${appointment.customer.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Müşteri Detayı →
                </Link>
              </div>
            </CardContent>
          </Card>

          {appointment.vehicle && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="size-4 text-slate-500" />
                  Araç
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlateBadge plate={appointment.vehicle.plate} />
                    <span className="text-sm text-slate-700">
                      {appointment.vehicle.brand} {appointment.vehicle.model}
                    </span>
                  </div>
                  <Link
                    href={`/app/vehicles/${appointment.vehicle.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Araç Detayı →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {appointment.customerRequest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-slate-500" />
                  Müşteri Talebi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{appointment.customerRequest}</p>
              </CardContent>
            </Card>
          )}

          {appointment.internalNote && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="size-4 text-slate-500" />
                  İç Not
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{appointment.internalNote}</p>
                <p className="mt-1 text-[11px] text-slate-500 italic">Bu not müşteriye gösterilmez</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="size-4 text-slate-500" />
                Randevu Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Randevu No</span>
                <span className="font-mono text-xs text-slate-900">{appointment.appointmentNo}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Oluşturulma</span>
                <span className="text-sm text-slate-900">{formatDateTime(appointment.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Süre</span>
                <span className="text-sm text-slate-900">
                  {appointment.estimatedDurationMinutes ? `${appointment.estimatedDurationMinutes} dk` : "—"}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-xs text-slate-500 block mb-1">Durum</span>
                <AppointmentStatusBadge status={appointment.status} size="md" />
              </div>
              <div className="pt-2 border-t">
                <span className="text-xs text-slate-500 block mb-1">Hatırlatma</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap h-6 px-2.5 text-xs",
                    reminderInfo?.color || "bg-slate-50 text-slate-400 border-slate-100"
                  )}
                >
                  {reminderInfo?.label || appointment.reminderStatus}
                </span>
                <p className="text-[11px] text-slate-500 mt-2">
                  Hatırlatma entegrasyonu yakında. Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="size-4 text-slate-500" />
                İşlemler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {!isTerminal && (
                <Button
                  onClick={handleConvert}
                  disabled={converting}
                  variant="default"
                  className="w-full"
                >
                  {converting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wrench className="size-4" />
                  )}
                  Randevuyu İş Emrine Çevir
                </Button>
              )}

              {isConverted && appointment.convertedServiceOrder && (
                <Link
                  href={`/app/orders/${appointment.convertedServiceOrder.id}`}
                  className="inline-flex items-center justify-center gap-2 w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Wrench className="size-4" />
                  İş Emrine Git
                  {appointment.convertedServiceOrder.workOrderNo && (
                    <span className="font-mono text-xs">({appointment.convertedServiceOrder.workOrderNo})</span>
                  )}
                </Link>
              )}

              {!isCancelled && !isConverted && (
                <form action={handleStatusUpdate}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 w-full h-9 px-3 rounded-lg border border-rose-200 bg-white text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <XCircle className="size-4" />
                    Randevuyu İptal Et
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  const text = `Merhaba ${customerDisplayName(appointment.customer)}, randevu bilgileriniz: ${appointment.appointmentNo} - ${formatDateTime(appointment.appointmentAt)}`
                  window.open(
                    `https://wa.me/${appointment.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
                    "_blank"
                  )
                }}
                className="inline-flex items-center justify-center gap-2 w-full h-9 px-3 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
              >
                <Share2 className="size-4" />
                WhatsApp ile Paylaş
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
