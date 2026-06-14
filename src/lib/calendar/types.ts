export type CalendarProviderType = "mock" | "google"

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startAt: Date
  endAt?: Date
  type: "appointment" | "delivery" | "maintenance_reminder"
  entityId?: string
  workshopId: string
}

export interface CalendarSyncResult {
  success: boolean
  externalEventId?: string
  error?: string
}

export interface CalendarProvider {
  createEvent(event: CalendarEvent): Promise<CalendarSyncResult>
  updateEvent(externalEventId: string, event: CalendarEvent): Promise<CalendarSyncResult>
  deleteEvent(externalEventId: string): Promise<CalendarSyncResult>
  listEvents(workshopId: string, startAt: Date, endAt: Date): Promise<CalendarEvent[]>
}