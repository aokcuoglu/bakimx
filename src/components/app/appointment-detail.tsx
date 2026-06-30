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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  updateAppointmentStatusAction,
  convertAppointmentToWorkOrderAction,
} from "@/app/(app)/appointments/actions"
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
        router.push(`/orders/${result.orderId}`)
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
      <div className="flex items-center text-sm text-muted-foreground">
        <button
          onClick={() => router.push("/appointments")}
          className="hover:text-foreground inline-flex items-center gap-1 touch-manipulation"
        >
          <ArrowLeft className="size-3.5" />
          Randevular
        </button>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{appointment.appointmentNo}</span>
      </div>

      {(statusUpdateError || convertError) && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{statusUpdateError || convertError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{appointment.appointmentNo}</span>
          <AppointmentStatusBadge status={appointment.status} size="md" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {appointment.title || "Randevu Detayı"}
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
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
                <input type="hidden" name="status" value={selectedStatus} />
                <Select
                  value={selectedStatus}
                  onValueChange={(v) => setSelectedStatus(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Durum seçin">
                      {(value: string | null) => {
                        if (!value) return null
                        const info = APPOINTMENT_STATUS[value as AppointmentStatusKey]
                        return info?.label || value
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {transitions.map((key) => {
                      const info = APPOINTMENT_STATUS[key]
                      return (
                        <SelectItem key={key} value={key}>
                          {info?.label || key}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
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
                <User className="size-4 text-muted-foreground" />
                Müşteri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {customerDisplayName(appointment.customer)}
                  </p>
                  <a
                    href={`tel:${appointment.customer.phone}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mt-1"
                  >
                    <Phone className="size-3.5" />
                    {appointment.customer.phone}
                  </a>
                </div>
                <Link
                  href={`/customers/${appointment.customer.id}`}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
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
                  <Car className="size-4 text-muted-foreground" />
                  Araç
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlateBadge plate={appointment.vehicle.plate} />
                    <span className="text-sm text-foreground">
                      {appointment.vehicle.brand} {appointment.vehicle.model}
                    </span>
                  </div>
                  <Link
                    href={`/vehicles/${appointment.vehicle.id}`}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
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
                  <FileText className="size-4 text-muted-foreground" />
                  Müşteri Talebi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{appointment.customerRequest}</p>
              </CardContent>
            </Card>
          )}

          {appointment.internalNote && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="size-4 text-muted-foreground" />
                  İç Not
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{appointment.internalNote}</p>
                <p className="mt-1 text-[11px] text-muted-foreground italic">Bu not müşteriye gösterilmez</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" />
                Randevu Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Randevu No</span>
                <span className="font-mono text-xs text-foreground">{appointment.appointmentNo}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Oluşturulma</span>
                <span className="text-sm text-foreground">{formatDateTime(appointment.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Süre</span>
                <span className="text-sm text-foreground">
                  {appointment.estimatedDurationMinutes ? `${appointment.estimatedDurationMinutes} dk` : "—"}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground block mb-1">Durum</span>
                <AppointmentStatusBadge status={appointment.status} size="md" />
              </div>
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground block mb-1">Hatırlatma</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap h-6 px-2.5 text-xs",
                    reminderInfo?.color || "bg-muted text-muted-foreground/70 border-border"
                  )}
                >
                  {reminderInfo?.label || appointment.reminderStatus}
                </span>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Hatırlatma entegrasyonu yakında. Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="size-4 text-muted-foreground" />
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
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  render={<Link href={`/orders/${appointment.convertedServiceOrder.id}`} />}
                >
                  <Wrench className="size-4" />
                  İş Emrine Git
                  {appointment.convertedServiceOrder.workOrderNo && (
                    <span className="font-mono text-xs">({appointment.convertedServiceOrder.workOrderNo})</span>
                  )}
                </Button>
              )}

              {!isCancelled && !isConverted && (
                <form action={handleStatusUpdate}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 w-full h-9 px-3 rounded-lg border border-destructive/20 bg-card text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
