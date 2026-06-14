import type { CalendarProvider, CalendarEvent, CalendarSyncResult } from "./types"

export class MockCalendarProvider implements CalendarProvider {
  private events: Map<string, CalendarEvent> = new Map()

  async createEvent(event: CalendarEvent): Promise<CalendarSyncResult> {
    const externalId = `mock-cal-${Date.now()}`
    this.events.set(externalId, { ...event, id: externalId })
    console.log(`[MockCalendar] Created event: ${event.title} (${event.type}) at ${event.startAt.toISOString()}`)
    return { success: true, externalEventId: externalId }
  }

  async updateEvent(externalEventId: string, event: CalendarEvent): Promise<CalendarSyncResult> {
    if (!this.events.has(externalEventId)) {
      return { success: false, error: "Event not found" }
    }
    this.events.set(externalEventId, { ...event, id: externalEventId })
    console.log(`[MockCalendar] Updated event: ${externalEventId}`)
    return { success: true, externalEventId }
  }

  async deleteEvent(externalEventId: string): Promise<CalendarSyncResult> {
    if (!this.events.has(externalEventId)) {
      return { success: false, error: "Event not found" }
    }
    this.events.delete(externalEventId)
    console.log(`[MockCalendar] Deleted event: ${externalEventId}`)
    return { success: true }
  }

  async listEvents(_workshopId: string, startAt: Date, endAt: Date): Promise<CalendarEvent[]> {
    const events = Array.from(this.events.values()).filter((e) => {
      return e.startAt >= startAt && e.startAt <= endAt
    })
    console.log(`[MockCalendar] Listed ${events.length} events between ${startAt.toISOString()} and ${endAt.toISOString()}`)
    return events
  }
}