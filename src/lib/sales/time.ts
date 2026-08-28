const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type IstanbulMonthBounds = {
  key: string
  label: string
  start: Date
  end: Date
  previousKey: string
  nextKey: string
  dayCount: number
}

function monthKey(year: number, zeroBasedMonth: number): string {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, "0")}`
}

/** Europe/Istanbul `datetime-local` değerini sunucu timezone'undan bağımsız UTC'ye çevirir. */
export function parseIstanbulLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second = "00"] = match
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  const date = new Date(localAsUtc - ISTANBUL_UTC_OFFSET_MS)
  const roundTrip = new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS)
  if (
    Number.isNaN(date.getTime()) ||
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    roundTrip.getUTCHours() !== Number(hour) ||
    roundTrip.getUTCMinutes() !== Number(minute) ||
    roundTrip.getUTCSeconds() !== Number(second)
  ) return null
  return date
}

/** UTC zamanı `datetime-local` bileşeninin beklediği İstanbul duvar saatine yazar. */
export function istanbulDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS).toISOString().slice(0, 16)
}

/** Europe/Istanbul has remained UTC+03:00 year-round since 2016. These bounds
 * keep the sales agenda independent from the server/container timezone. */
export function istanbulDayBounds(now = new Date()): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const localMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  )
  const start = new Date(localMidnightAsUtc - ISTANBUL_UTC_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

/** `YYYY-MM` değerini Europe/Istanbul takvim ayının [start, end) UTC sınırlarına
 * çevirir. Geçersiz değerlerde içinde bulunulan İstanbul ayına döner. */
export function istanbulMonthBounds(value?: string | null, now = new Date()): IstanbulMonthBounds {
  const shiftedNow = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null
  const requestedYear = match ? Number(match[1]) : Number.NaN
  const requestedMonth = match ? Number(match[2]) - 1 : Number.NaN
  const valid = Number.isInteger(requestedYear)
    && requestedYear >= 2000
    && requestedYear <= 2200
    && requestedMonth >= 0
    && requestedMonth <= 11
  const year = valid ? requestedYear : shiftedNow.getUTCFullYear()
  const month = valid ? requestedMonth : shiftedNow.getUTCMonth()
  const localStartAsUtc = Date.UTC(year, month, 1)
  const localEndAsUtc = Date.UTC(year, month + 1, 1)
  const previous = new Date(Date.UTC(year, month - 1, 1))
  const next = new Date(Date.UTC(year, month + 1, 1))

  return {
    key: monthKey(year, month),
    label: new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(localStartAsUtc)),
    start: new Date(localStartAsUtc - ISTANBUL_UTC_OFFSET_MS),
    end: new Date(localEndAsUtc - ISTANBUL_UTC_OFFSET_MS),
    previousKey: monthKey(previous.getUTCFullYear(), previous.getUTCMonth()),
    nextKey: monthKey(next.getUTCFullYear(), next.getUTCMonth()),
    dayCount: Math.round((localEndAsUtc - localStartAsUtc) / DAY_MS),
  }
}
