import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { CalendarView } from "@/components/appointments/calendar-view"
import { getCalendarEvents } from "@/lib/calendar/queries"

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
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-5 sm:space-y-6">

        <CalendarView
          initialEvents={serializedEvents}
          initialView={view}
          initialDate={dateStr}
        />
      </div>
    </AppShell>
  )
}
