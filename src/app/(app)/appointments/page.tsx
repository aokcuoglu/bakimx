import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, CalendarClock, Search, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AppointmentList } from "@/components/appointments/appointment-list"
import { formatAppointmentNo } from "@/lib/work-order-number"
import { appointmentTodayBounds, resolveAppointmentDateWindow } from "@/lib/appointments/date-filter"

export const metadata = { title: "Randevular" }

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; date?: string }>
}) {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const status = (params.status || "").trim()
  const date = (params.date || params.date === "" ? params.date || "" : "today").trim()
  const activeDate = date || "today"
  const activeStatus = status

  // Gün sınırları Türkiye takvimine göre (#874).
  const now = new Date()
  const { today, tomorrow } = appointmentTodayBounds(now)

  const where: Record<string, unknown> = { workshopId: user.workshopId }

  if (activeStatus) {
    where.status = activeStatus
  }

  const dateWindow = resolveAppointmentDateWindow(activeDate, now)
  if (dateWindow) {
    where.appointmentAt = dateWindow
  }

  if (q) {
    where.OR = [
      { appointmentNo: { contains: q, mode: "insensitive" as const } },
      { customer: { phone: { contains: q } } },
      { customer: { firstName: { contains: q, mode: "insensitive" as const } } },
      { customer: { lastName: { contains: q, mode: "insensitive" as const } } },
      { customer: { fullName: { contains: q, mode: "insensitive" as const } } },
      { customer: { companyName: { contains: q, mode: "insensitive" as const } } },
      { vehicle: { plate: { contains: q, mode: "insensitive" as const } } },
    ]
  }

  const appointments = await prisma.appointment.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      convertedServiceOrder: { select: { id: true, workOrderNo: true } },
    },
    orderBy: { appointmentAt: "desc" },
  })

  const [todayCount, upcomingCount, confirmedCount, arrivedCount, noShowCount, cancelledCount] = await Promise.all([
    prisma.appointment.count({
      where: { workshopId: user.workshopId, appointmentAt: { gte: today, lt: tomorrow }, status: { notIn: ["cancelled", "no_show", "completed"] } },
    }),
    prisma.appointment.count({
      where: { workshopId: user.workshopId, appointmentAt: { gte: tomorrow }, status: { notIn: ["cancelled", "no_show", "completed"] } },
    }),
    prisma.appointment.count({ where: { workshopId: user.workshopId, status: "confirmed" } }),
    prisma.appointment.count({ where: { workshopId: user.workshopId, status: "arrived" } }),
    prisma.appointment.count({ where: { workshopId: user.workshopId, status: "no_show" } }),
    prisma.appointment.count({ where: { workshopId: user.workshopId, status: "cancelled" } }),
  ])

  const serializedAppointments = appointments.map((a) => ({
    id: a.id,
    appointmentNo: formatAppointmentNo(a),
    status: a.status,
    appointmentAt: a.appointmentAt.toISOString(),
    estimatedDurationMinutes: a.estimatedDurationMinutes,
    title: a.title,
    customerRequest: a.customerRequest,
    reminderStatus: a.reminderStatus,
    customer: a.customer,
    vehicle: a.vehicle,
    convertedServiceOrder: a.convertedServiceOrder,
  }))

  const dateTabs = [
    { key: "today", label: "Bugün" },
    { key: "tomorrow", label: "Yarın" },
    { key: "week", label: "Bu Hafta" },
    { key: "all", label: "Tümü" },
  ]

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-5 sm:space-y-6">

        <form action="/appointments" method="get" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Randevu no, plaka veya müşteri adı ile ara..."
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="default"
            type="submit"
          >
            <Search className="size-4" />
            Ara
          </Button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <CalendarDays className="size-4 text-muted-foreground shrink-0" />
          {dateTabs.map((tab) => {
            const isActive = activeDate === tab.key
            const href = isActive
              ? `/appointments${q ? `?q=${q}` : ""}${activeStatus ? `${q ? "&" : "?"}status=${activeStatus}` : ""}`
              : tab.key === "all"
              ? `/appointments${q ? `?q=${q}` : ""}${activeStatus ? `${q ? "&" : "?"}status=${activeStatus}` : ""}`
              : `/appointments?date=${tab.key}${q ? `&q=${q}` : ""}${activeStatus ? `&status=${activeStatus}` : ""}`
            return (
              <Button
                key={tab.key}
                variant={isActive ? "tint" : "ghost"}
                size="compact"
                className="whitespace-nowrap"
                asChild
              >
                <Link href={href} aria-current={isActive ? "page" : undefined}>
                  {tab.label}
                </Link>
              </Button>
            )
          })}
        </div>

        <AppointmentList
          appointments={serializedAppointments}
          counts={{
            today: todayCount,
            upcoming: upcomingCount,
            confirmed: confirmedCount,
            arrived: arrivedCount,
            no_show: noShowCount,
            cancelled: cancelledCount,
          }}
          activeStatus={activeStatus}
          activeDate={activeDate}
          search={q}
        />

        {appointments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarClock className="size-14 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-base font-medium">
              {q || activeStatus || activeDate !== "today"
                ? "Filtrelere uyan randevu bulunamadı"
                : "Henüz randevu yok"}
            </p>
            <p className="text-sm mt-1">
              {q || activeStatus || activeDate !== "today"
                ? "Farklı bir filtre deneyin"
                : "Yeni bir randevu oluşturarak başlayabilirsiniz"}
            </p>
            <Link
              href="/appointments/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline font-medium"
            >
              <Plus className="size-4" />
              Yeni Randevu
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}
