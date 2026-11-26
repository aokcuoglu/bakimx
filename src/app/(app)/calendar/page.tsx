import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { CalendarView } from "@/components/appointments/calendar-view"
import { getCalendarEvents } from "@/lib/calendar/queries"
import { calendarViewRange, parseCalendarViewMode, resolveDayKey } from "@/lib/calendar/calendar-grid"

export const metadata = { title: "Takvim" }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const view = parseCalendarViewMode(params.view)
  const dateStr = resolveDayKey(params.date)
  const { start, end } = calendarViewRange(view, dateStr)

  const events = await getCalendarEvents(user.workshopId, start, end)

  const serializedEvents = events.map((e) => ({
    ...e,
  }))

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-5 sm:space-y-6">

        <CalendarView
          events={serializedEvents}
          view={view}
          date={dateStr}
        />
      </div>
    </AppShell>
  )
}
