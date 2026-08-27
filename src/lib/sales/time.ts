const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

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
