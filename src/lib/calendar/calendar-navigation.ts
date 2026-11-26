import { addDays, addMonths, isDayKey, type CalendarViewMode } from "./calendar-grid"

/** Takvim adresi: görünüm ve gün her zaman birlikte yazılır (URL tek kaynaktır). */
export function calendarHref(view: CalendarViewMode, dayKey: string): string {
  return `/calendar?view=${view}&date=${dayKey}`
}

/** Önceki/sonraki aralığın gün anahtarı; desteklenen yıl aralığı dışına çıkarsa girdi aynen döner. */
export function shiftCalendarDay(
  view: CalendarViewMode,
  dayKey: string,
  direction: "prev" | "next",
): string {
  const sign = direction === "next" ? 1 : -1
  const next =
    view === "day"
      ? addDays(dayKey, sign)
      : view === "week"
        ? addDays(dayKey, sign * 7)
        : addMonths(dayKey, sign)
  return isDayKey(next) ? next : dayKey
}
