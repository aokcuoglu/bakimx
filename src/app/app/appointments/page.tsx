import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, CalendarClock, Search, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AppointmentList } from "@/components/app/appointment-list"
import { formatAppointmentNo } from "@/lib/work-order-number"
import { cn } from "@/lib/utils"

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; date?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const status = (params.status || "").trim()
  const date = (params.date || params.date === "" ? params.date || "" : "today").trim()
  const activeDate = date || "today"
  const activeStatus = status

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 1)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const where: Record<string, unknown> = { workshopId: user.workshopId }

  if (activeStatus) {
    where.status = activeStatus
  }

  if (activeDate === "today") {
    where.appointmentAt = { gte: today, lt: tomorrow }
  } else if (activeDate === "tomorrow") {
    where.appointmentAt = { gte: tomorrow, lt: dayAfter }
  } else if (activeDate === "week") {
    where.appointmentAt = { gte: today, lt: weekEnd }
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
    <AppShell
      workshopName={workshop?.name}
      pageTitle="Randevular"
      pageActions={
        <Link
          href="/app/appointments/new"
          className="inline-flex items-center justify-center size-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
          aria-label="Yeni randevu"
        >
          <Plus className="size-5" />
        </Link>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Randevular</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Randevular</h2>
            <p className="text-sm text-slate-500 mt-0.5">Servis randevularını planlayın ve yönetin</p>
          </div>
          <Link
            href="/app/appointments/new"
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            <Plus className="size-4" />
            Yeni Randevu
          </Link>
        </div>

        <form action="/app/appointments" method="get" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Randevu no, plaka veya müşteri adı ile ara..."
              className="pl-10 h-11"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            <Search className="size-4" />
            Ara
          </button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <CalendarDays className="size-4 text-slate-400 shrink-0" />
          {dateTabs.map((tab) => {
            const isActive = activeDate === tab.key
            const href = isActive
              ? `/app/appointments${q ? `?q=${q}` : ""}${activeStatus ? `${q ? "&" : "?"}status=${activeStatus}` : ""}`
              : tab.key === "all"
              ? `/app/appointments${q ? `?q=${q}` : ""}${activeStatus ? `${q ? "&" : "?"}status=${activeStatus}` : ""}`
              : `/app/appointments?date=${tab.key}${q ? `&q=${q}` : ""}${activeStatus ? `&status=${activeStatus}` : ""}`
            return (
              <Link
                key={tab.key}
                href={href}
                className={cn(
                  "h-8 px-3 inline-flex items-center rounded-lg text-sm font-medium whitespace-nowrap transition-colors touch-manipulation",
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </Link>
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
          <div className="text-center py-16 text-slate-500">
            <CalendarClock className="size-14 mx-auto mb-4 text-slate-300" />
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
              href="/app/appointments/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
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


