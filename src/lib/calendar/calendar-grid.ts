import { TR_TIME_ZONE, trDayKey } from "@/lib/format-date"
import { ISTANBUL_UTC_OFFSET_MS } from "@/lib/istanbul-time"

/**
 * Takvim ızgarası: tüm gün aritmetiği `YYYY-MM-DD` anahtarları üzerinde ve UTC
 * getter'larıyla yapılır; tarayıcı/sunucu saat diliminden bağımsızdır (#876).
 * Client-safe: prisma'ya dokunan `./index` buradan yeniden dışa aktarılmaz.
 */

export type CalendarViewMode = "day" | "week" | "month"

const DAY_MS = 24 * 60 * 60 * 1000
// Uç yıllar Date.UTC/toISOString taşmasına (0–99 → 19xx, 9999+ → "+010000") girer.
const MIN_YEAR = 1970
const MAX_YEAR = 2100
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseCalendarViewMode(value?: string): CalendarViewMode {
  return value === "day" || value === "week" || value === "month" ? value : "week"
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const match = DAY_KEY_PATTERN.exec(key)
  if (!match) throw new Error(`Geçersiz gün anahtarı: ${key}`)
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
}

function keyFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function keyToUtc(key: string): number {
  const { y, m, d } = parseKey(key)
  return Date.UTC(y, m, d)
}

export function isDayKey(value: string): boolean {
  const match = DAY_KEY_PATTERN.exec(value)
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  const d = Number(match[3])
  if (y < MIN_YEAR || y > MAX_YEAR) return false
  const date = new Date(Date.UTC(y, m, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m && date.getUTCDate() === d
}

export function istanbulTodayKey(now: Date = new Date()): string {
  return trDayKey(now)
}

export function resolveDayKey(value: string | undefined, now?: Date): string {
  return value && isDayKey(value) ? value : istanbulTodayKey(now)
}

export function addDays(key: string, n: number): string {
  return keyFromUtc(keyToUtc(key) + n * DAY_MS)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

export function addMonths(key: string, n: number): string {
  const { y, m, d } = parseKey(key)
  const target = new Date(Date.UTC(y, m + n, 1))
  const ty = target.getUTCFullYear()
  const tm = target.getUTCMonth()
  return keyFromUtc(Date.UTC(ty, tm, Math.min(d, daysInMonth(ty, tm))))
}

/** 0 = Pazartesi … 6 = Pazar. */
export function mondayIndex(key: string): number {
  return (new Date(keyToUtc(key)).getUTCDay() + 6) % 7
}

export function weekDayKeys(key: string): string[] {
  const monday = addDays(key, -mondayIndex(key))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function monthStartKey(key: string): string {
  const { y, m } = parseKey(key)
  return keyFromUtc(Date.UTC(y, m, 1))
}

export function monthDayKeys(key: string): string[] {
  const { y, m } = parseKey(key)
  return Array.from({ length: daysInMonth(y, m) }, (_, i) => keyFromUtc(Date.UTC(y, m, i + 1)))
}

export function monthLeadingBlanks(key: string): number {
  return mondayIndex(monthStartKey(key))
}

export function dayKeysInView(view: CalendarViewMode, key: string): string[] {
  if (view === "day") return [key]
  if (view === "week") return weekDayKeys(key)
  return monthDayKeys(key)
}

function istanbulMidnight(key: string): Date {
  return new Date(keyToUtc(key) - ISTANBUL_UTC_OFFSET_MS)
}

/** [start, end) — İstanbul gece yarısı anları. */
export function calendarViewRange(view: CalendarViewMode, key: string): { start: Date; end: Date } {
  if (view === "day") {
    return { start: istanbulMidnight(key), end: istanbulMidnight(addDays(key, 1)) }
  }
  if (view === "week") {
    const monday = addDays(key, -mondayIndex(key))
    return { start: istanbulMidnight(monday), end: istanbulMidnight(addDays(monday, 7)) }
  }
  const first = monthStartKey(key)
  return { start: istanbulMidnight(first), end: istanbulMidnight(addMonths(first, 1)) }
}

export function groupByIstanbulDay<T extends { startAt: string }>(events: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const event of events) {
    const dayKey = trDayKey(event.startAt)
    if (dayKey === "—") continue
    if (!grouped[dayKey]) grouped[dayKey] = []
    grouped[dayKey].push(event)
  }
  return grouped
}

export function dayOfMonth(key: string): number {
  return parseKey(key).d
}

/** Anahtarın İstanbul öğlenini verir; etiketler hangi zonda çalışırsa çalışsın aynı gündür. */
function noonInstant(key: string): Date {
  return new Date(keyToUtc(key) + 12 * 60 * 60 * 1000 - ISTANBUL_UTC_OFFSET_MS)
}

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TIME_ZONE, weekday: "long" })
const dayMonthYearFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})
const monthTitleFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  month: "long",
  year: "numeric",
})
const dayHeadingFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

export function formatWeekdayName(key: string): string {
  return weekdayFormatter.format(noonInstant(key))
}

export function formatDayTitle(key: string): string {
  return `${formatWeekdayName(key)}, ${dayMonthYearFormatter.format(noonInstant(key))}`
}

export function formatMonthTitle(key: string): string {
  return monthTitleFormatter.format(noonInstant(key))
}

export function formatDayHeading(key: string): string {
  return dayHeadingFormatter.format(noonInstant(key))
}
