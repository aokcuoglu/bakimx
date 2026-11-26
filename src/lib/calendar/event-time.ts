import { formatTrTime } from "@/lib/format-date"
import { istanbulDayKey } from "@/lib/istanbul-time"

export const ALL_DAY_LABEL = "Tüm gün"

interface TimedEvent {
  startAt: string
  endAt?: string
  allDay?: boolean
}

// Bakım hatırlatmasının `dueDate`i yalnız tarihtir (UTC gece yarısı); saat olarak
// biçimlenirse İstanbul'da "03:00" görünür (#903). Tüm gün etkinlikte saat yazılmaz.
export function eventStartLabel(event: TimedEvent): string {
  return event.allDay ? ALL_DAY_LABEL : formatTrTime(event.startAt)
}

export function eventTimeRangeLabel(event: TimedEvent): string {
  if (event.allDay) return ALL_DAY_LABEL
  const start = formatTrTime(event.startAt)
  return event.endAt ? `${start} — ${formatTrTime(event.endAt)}` : start
}

// Aynı gün içinde tüm gün etkinlikler saatli olanların önünde durur.
export function compareCalendarItems(a: TimedEvent, b: TimedEvent): number {
  const dayA = istanbulDayKey(new Date(a.startAt))
  const dayB = istanbulDayKey(new Date(b.startAt))
  if (dayA !== dayB) return dayA < dayB ? -1 : 1
  if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1
  return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
}
