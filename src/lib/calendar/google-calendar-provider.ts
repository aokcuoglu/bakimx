import type { CalendarProvider, CalendarEvent, CalendarSyncResult } from "./types"

const GOOGLE_CALENDAR_API = process.env.GOOGLE_CALENDAR_API_URL || "https://www.googleapis.com/calendar/v3"

function getCredentials(): { calendarId: string; accessToken: string } | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN
  if (!calendarId || !accessToken) return null
  return { calendarId, accessToken }
}

export class GoogleCalendarProvider implements CalendarProvider {
  async createEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    const creds = getCredentials()
    if (!creds) {
      return { success: false, error: "Google Calendar credentials not configured" }
    }

    try {
      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${creds.calendarId}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description || "",
          start: { dateTime: event.startAt.toISOString() },
          end: { dateTime: (event.endAt || new Date(event.startAt.getTime() + 60 * 60 * 1000)).toISOString() },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        return { success: false, error: `Google Calendar API error: ${response.status} ${body}` }
      }

      const data = await response.json()
      return { success: true, externalEventId: data.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  async updateEvent(externalEventId: string, event: CalendarEvent): Promise<CalendarSyncResult> {
    const creds = getCredentials()
    if (!creds) {
      return { success: false, error: "Google Calendar credentials not configured" }
    }

    try {
      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${creds.calendarId}/events/${externalEventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description || "",
          start: { dateTime: event.startAt.toISOString() },
          end: { dateTime: (event.endAt || new Date(event.startAt.getTime() + 60 * 60 * 1000)).toISOString() },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        return { success: false, error: `Google Calendar API error: ${response.status} ${body}` }
      }

      return { success: true, externalEventId }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  async deleteEvent(externalEventId: string): Promise<CalendarSyncResult> {
    const creds = getCredentials()
    if (!creds) {
      return { success: false, error: "Google Calendar credentials not configured" }
    }

    try {
      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${creds.calendarId}/events/${externalEventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      })

      if (!response.ok && response.status !== 404) {
        const body = await response.text()
        return { success: false, error: `Google Calendar API error: ${response.status} ${body}` }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  async listEvents(workshopId: string, startAt: Date, endAt: Date): Promise<CalendarEvent[]> {
    const creds = getCredentials()
    if (!creds) return []

    try {
      const params = new URLSearchParams({
        timeMin: startAt.toISOString(),
        timeMax: endAt.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
      })

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${creds.calendarId}/events?${params}`,
        {
          headers: { Authorization: `Bearer ${creds.accessToken}` },
        },
      )

      if (!response.ok) return []

      const data = await response.json()
      return (data.items || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        title: (item.summary as string) || "",
        description: (item.description as string) || undefined,
        startAt: new Date((item.start as Record<string, string>).dateTime || (item.start as Record<string, string>).date || ""),
        endAt: (item.end as Record<string, string>)?.dateTime ? new Date((item.end as Record<string, string>).dateTime) : undefined,
        type: "appointment" as const,
        workshopId,
      }))
    } catch {
      return []
    }
  }
}