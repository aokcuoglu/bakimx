import type { CalendarProvider, CalendarProviderType } from "./types"
import { MockCalendarProvider } from "./mock-calendar-provider"

let calendarProviderInstance: CalendarProvider | null = null

export function getCalendarProvider(): CalendarProvider {
  if (calendarProviderInstance) return calendarProviderInstance
  calendarProviderInstance = createCalendarProvider()
  return calendarProviderInstance
}

function createCalendarProvider(): CalendarProvider {
  const providerType = (process.env.CALENDAR_PROVIDER || "mock") as CalendarProviderType

  switch (providerType) {
    case "google": {
      const hasCredentials = process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_CALENDAR_ACCESS_TOKEN
      if (!hasCredentials) {
        console.warn("[Calendar] CALENDAR_PROVIDER=google but credentials missing. Falling back to mock.")
        return new MockCalendarProvider()
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleCalendarProvider } = require("./google-calendar-provider")
      return new GoogleCalendarProvider() as CalendarProvider
    }
    case "mock":
    default:
      return new MockCalendarProvider()
  }
}

export function resetCalendarProvider(): void {
  calendarProviderInstance = null
}

export type { CalendarProvider, CalendarProviderType, CalendarEvent, CalendarSyncResult } from "./types"
export { MockCalendarProvider } from "./mock-calendar-provider"
export { syncAppointmentToCalendar, syncDeliveryToCalendar, syncMaintenanceReminderToCalendar, getCalendarSyncLogs } from "./sync"
export { getCalendarEvents } from "./queries"
export type { CalendarViewItem } from "./queries"
export { runAllReminderJobs, runAppointmentReminderJob, runMaintenanceReminderJob, runDeliveryReminderJob, getReminderExecutionLogs } from "./reminder-scheduler"