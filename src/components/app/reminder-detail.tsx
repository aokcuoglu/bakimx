"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Pencil,
  BellRing,
  CheckCircle2,
  Calendar,
  Gauge,
  Clock,
  XCircle,
  CalendarClock,
  Wrench,
  User,
  Car,
  FileText,
  Info,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/app/reminder-status-badge"
import { PlateBadge } from "@/components/app/plate-badge"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import {
  completeReminderAction,
  postponeReminderAction,
  cancelReminderAction,
  createAppointmentFromReminderAction,
} from "@/app/app/reminders/actions"

type SafeReminder = {
  id: string
  title: string
  type: string
  status: string
  dueDate: string | null
  dueMileage: number | null
  currentMileage: number | null
  lastServiceDate: string | null
  lastServiceMileage: number | null
  reminderDaysBefore: number | null
  reminderKmBefore: number | null
  preferredChannel: string
  reminderStatus: string
  customerNote: string | null
  internalNote: string | null
  completedAt: string | null
  completedServiceOrderId: string | null
  createdAppointmentId: string | null
  createdAt: string
  updatedAt: string
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
    mileage: number | null
  }
  createdAppointment: {
    id: string
    appointmentNo: string
    status: string
    appointmentAt: string
  } | null
}

function customerDisplayName(c: SafeReminder["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal Müşteri"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}

export function ReminderDetail({ reminder }: { reminder: SafeReminder }) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [showPostpone, setShowPostpone] = useState(false)
  const [postponeDate, setPostponeDate] = useState("")
  const [postponeMileage, setPostponeMileage] = useState("")

  const isActive = ["upcoming", "due_soon", "overdue"].includes(reminder.status)
  const isTerminal = ["completed", "cancelled"].includes(reminder.status)

  async function handleAction(action: string) {
    setActionLoading(true)
    setActionError("")
    try {
      const form = new FormData()
      form.append("id", reminder.id)

      switch (action) {
        case "complete":
          await completeReminderAction(form)
          router.refresh()
          break
        case "cancel":
          await cancelReminderAction(form)
          router.refresh()
          break
        case "create-appointment": {
          const result = await createAppointmentFromReminderAction(form)
          if (result?.redirect) {
            router.push(result.redirect)
            return
          }
          router.refresh()
          break
        }
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePostpone(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    setActionError("")
    try {
      const form = new FormData()
      form.append("id", reminder.id)
      form.append("dueDate", postponeDate)
      form.append("dueMileage", postponeMileage)
      await postponeReminderAction(form)
      router.refresh()
      setShowPostpone(false)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/app/reminders" className="hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" />
          Bakım Hatırlatmaları
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700 font-medium truncate">{reminder.title}</span>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">{actionError}</div>
      ) : null}

      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-xl bg-[#0B1F3A] flex items-center justify-center text-white shrink-0">
              <BellRing className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{reminder.title}</h2>
                <ReminderStatusBadge status={reminder.status} size="md" />
                <ReminderTypeBadge type={reminder.type} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs sm:text-sm text-slate-500 flex-wrap">
                {reminder.dueDate ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {formatDate(reminder.dueDate)}
                  </span>
                ) : null}
                {reminder.dueMileage ? (
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-3.5" />
                    {reminder.dueMileage.toLocaleString("tr-TR")} km
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <>
                <button
                  onClick={() => handleAction("complete")}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 touch-manipulation"
                >
                  {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  <span className="hidden sm:inline">Tamamlandı</span>
                </button>
                <button
                  onClick={() => setShowPostpone(!showPostpone)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
                >
                  <Clock className="size-4" />
                  <span className="hidden sm:inline">Ertele</span>
                </button>
              </>
            ) : null}
            {!isTerminal ? (
              <button
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-medium transition-colors disabled:opacity-50 touch-manipulation"
              >
                <XCircle className="size-4" />
                <span className="hidden sm:inline">İptal</span>
              </button>
            ) : null}
            <Link
              href={`/app/reminders/${reminder.id}/edit`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline">Düzenle</span>
            </Link>
          </div>
        </div>

        {isActive ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {!reminder.createdAppointmentId ? (
              <button
                onClick={() => handleAction("create-appointment")}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors disabled:opacity-50 touch-manipulation"
              >
                <CalendarClock className="size-3.5" />
                Randevu Oluştur
              </button>
            ) : null}
            <Link
              href={`/app/orders/new?customerId=${reminder.customer.id}&vehicleId=${reminder.vehicle.id}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors touch-manipulation"
            >
              <Wrench className="size-3.5" />
              İş Emri Oluştur
            </Link>
          </div>
        ) : null}
      </header>

      {showPostpone ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4" />
              Hatırlatmayı Ertele
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handlePostpone} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Yeni Tarih</label>
                  <Input type="date" value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)} className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Yeni KM</label>
                  <Input type="number" min="1" value={postponeMileage} onChange={(e) => setPostponeMileage(e.target.value)} placeholder="Örn: 20000" className="mt-1 h-9" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={actionLoading} size="sm" className="gap-1.5">
                  {actionLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Ertele
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPostpone(false)}>
                  Vazgeç
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BellRing className="size-4 text-slate-500" />
                Hatırlatma Detayı
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <DetailItem label="Başlık" value={reminder.title} />
                <DetailItem label="Bakım Türü" value={<ReminderTypeBadge type={reminder.type} />} />
                <DetailItem label="Durum" value={<ReminderStatusBadge status={reminder.status} />} />
                <DetailItem label="Planlanan Tarih" value={reminder.dueDate ? formatDate(reminder.dueDate) : "—"} />
                <DetailItem label="Planlanan KM" value={reminder.dueMileage ? `${reminder.dueMileage.toLocaleString("tr-TR")} km` : "—"} />
                <DetailItem label="Mevcut KM" value={reminder.currentMileage != null ? `${reminder.currentMileage.toLocaleString("tr-TR")} km` : "—"} />
                <DetailItem label="Son Bakım Tarihi" value={reminder.lastServiceDate ? formatDate(reminder.lastServiceDate) : "—"} />
                <DetailItem label="Son Bakım KM" value={reminder.lastServiceMileage ? `${reminder.lastServiceMileage.toLocaleString("tr-TR")} km` : "—"} />
                <DetailItem label="Uyarı (gün)" value={reminder.reminderDaysBefore != null ? `${reminder.reminderDaysBefore} gün` : "—"} />
                <DetailItem label="Uyarı (km)" value={reminder.reminderKmBefore != null ? `${reminder.reminderKmBefore} km` : "—"} />
                <DetailItem label="Kanal" value={channelLabel(reminder.preferredChannel)} />
                <DetailItem label="Hatırlatma Durumu" value={reminderStatusLabel(reminder.reminderStatus)} />
                {reminder.completedAt ? (
                  <DetailItem label="Tamamlanma" value={formatDateTime(reminder.completedAt)} />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {reminder.customerNote ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-slate-500" />
                  Müşteri Notu
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reminder.customerNote}</p>
              </CardContent>
            </Card>
          ) : null}

          {reminder.internalNote ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-slate-500" />
                  İç Not
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reminder.internalNote}</p>
              </CardContent>
            </Card>
          ) : null}

          {reminder.createdAppointment ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="size-4 text-slate-500" />
                  Oluşturulan Randevu
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href={`/app/appointments/${reminder.createdAppointment.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {reminder.createdAppointment.appointmentNo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(reminder.createdAppointment.appointmentAt)}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Görüntüle</span>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <User className="size-4 text-slate-500" />
                Müşteri
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                href={`/app/customers/${reminder.customer.id}`}
                className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-slate-50 transition-colors"
              >
                <div className="size-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {customerDisplayName(reminder.customer)}
                  </p>
                  <p className="text-xs text-slate-500">{reminder.customer.phone}</p>
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Car className="size-4 text-slate-500" />
                Araç
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                href={`/app/vehicles/${reminder.vehicle.id}`}
                className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-slate-50 transition-colors"
              >
                <div className="size-10 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center shrink-0">
                  <Car className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <PlateBadge plate={reminder.vehicle.plate} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {reminder.vehicle.brand} {reminder.vehicle.model}
                  </p>
                  {reminder.vehicle.mileage != null ? (
                    <p className="text-xs text-slate-400">
                      KM: {reminder.vehicle.mileage.toLocaleString("tr-TR")}
                    </p>
                  ) : null}
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Info className="size-4 text-slate-500" />
                Kayıt Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Oluşturulma</span>
                <span className="text-slate-700">{formatDate(reminder.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Güncelleme</span>
                <span className="text-slate-700">{formatDate(reminder.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {isActive ? (
              <Link href={`/app/orders/new?customerId=${reminder.customer.id}&vehicleId=${reminder.vehicle.id}`}>
                <Button variant="outline" className="w-full gap-2">
                  <Wrench className="size-4" />
                  İş Emri Oluştur
                </Button>
              </Link>
            ) : null}
            <Link href={`/app/reminders/${reminder.id}/edit`}>
              <Button variant="outline" className="w-full gap-2">
                <Pencil className="size-4" />
                Düzenle
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
      <dt className="text-[11px] text-slate-500 font-medium">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 mt-0.5">{value}</dd>
    </div>
  )
}

function channelLabel(c: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-posta",
  }
  return labels[c] || c
}

function reminderStatusLabel(s: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    pending: "Bekliyor",
    sent: "Gönderildi",
    failed: "Başarısız",
  }
  return labels[s] || s
}
