import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { CalendarView } from "@/components/app/calendar-view"
import { getCalendarEvents } from "@/lib/calendar/queries"
import Link from "next/link"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const view = params.view || "week"
  const dateStr = params.date || new Date().toISOString().split("T")[0]

  const baseDate = new Date(dateStr + "T00:00:00")
  let startDate: Date
  let endDate: Date

  if (view === "day") {
    startDate = new Date(baseDate)
    endDate = new Date(baseDate)
    endDate.setDate(endDate.getDate() + 1)
  } else if (view === "month") {
    startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
    endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)
  } else {
    const dayOfWeek = baseDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    startDate = new Date(baseDate)
    startDate.setDate(baseDate.getDate() + mondayOffset)
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 7)
  }

  const events = await getCalendarEvents(user.workshopId, startDate, endDate)

  const serializedEvents = events.map((e) => ({
    ...e,
  }))

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Takvim">
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Takvim</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Takvim</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Randevular, teslimatlar ve bakım hatırlatmaları</p>
          </div>
        </div>

        <CalendarView
          initialEvents={serializedEvents}
          initialView={view}
          initialDate={dateStr}
        />
      </div>
    </AppShell>
  )
}