const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

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
