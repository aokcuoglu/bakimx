// Karakterizasyon (#934): ızgara çıktısı istanbul-time yardımcılarına geçişte
// değişmemeli. Altın değerler refactor öncesi koddan üretildi; ay Pazar/Pazartesi
// başlar, artık şubat, Aralık→Ocak geçişi içerir. Her TZ ile koşar:
//   TZ=UTC bun test src/lib/calendar/calendar-grid-characterization.test.ts
//   TZ=Europe/Istanbul bun test src/lib/calendar/calendar-grid-characterization.test.ts
import { describe, expect, test } from "bun:test"
import {
  calendarViewRange,
  mondayIndex,
  monthDayKeys,
  monthLeadingBlanks,
  weekDayKeys,
} from "./calendar-grid"

const GOLDEN = {"2026-03-01":{"mi":6,"blanks":6,"days":31,"first":"2026-03-01","last":"2026-03-31","week":["2026-02-23","2026-03-01"],"day":["2026-02-28T21:00:00.000Z","2026-03-01T21:00:00.000Z"],"weekR":["2026-02-22T21:00:00.000Z","2026-03-01T21:00:00.000Z"],"month":["2026-02-28T21:00:00.000Z","2026-03-31T21:00:00.000Z"]},"2026-06-01":{"mi":0,"blanks":0,"days":30,"first":"2026-06-01","last":"2026-06-30","week":["2026-06-01","2026-06-07"],"day":["2026-05-31T21:00:00.000Z","2026-06-01T21:00:00.000Z"],"weekR":["2026-05-31T21:00:00.000Z","2026-06-07T21:00:00.000Z"],"month":["2026-05-31T21:00:00.000Z","2026-06-30T21:00:00.000Z"]},"2026-02-15":{"mi":6,"blanks":6,"days":28,"first":"2026-02-01","last":"2026-02-28","week":["2026-02-09","2026-02-15"],"day":["2026-02-14T21:00:00.000Z","2026-02-15T21:00:00.000Z"],"weekR":["2026-02-08T21:00:00.000Z","2026-02-15T21:00:00.000Z"],"month":["2026-01-31T21:00:00.000Z","2026-02-28T21:00:00.000Z"]},"2028-02-29":{"mi":1,"blanks":1,"days":29,"first":"2028-02-01","last":"2028-02-29","week":["2028-02-28","2028-03-05"],"day":["2028-02-28T21:00:00.000Z","2028-02-29T21:00:00.000Z"],"weekR":["2028-02-27T21:00:00.000Z","2028-03-05T21:00:00.000Z"],"month":["2028-01-31T21:00:00.000Z","2028-02-29T21:00:00.000Z"]},"2026-12-31":{"mi":3,"blanks":1,"days":31,"first":"2026-12-01","last":"2026-12-31","week":["2026-12-28","2027-01-03"],"day":["2026-12-30T21:00:00.000Z","2026-12-31T21:00:00.000Z"],"weekR":["2026-12-27T21:00:00.000Z","2027-01-03T21:00:00.000Z"],"month":["2026-11-30T21:00:00.000Z","2026-12-31T21:00:00.000Z"]},"2027-01-01":{"mi":4,"blanks":4,"days":31,"first":"2027-01-01","last":"2027-01-31","week":["2026-12-28","2027-01-03"],"day":["2026-12-31T21:00:00.000Z","2027-01-01T21:00:00.000Z"],"weekR":["2026-12-27T21:00:00.000Z","2027-01-03T21:00:00.000Z"],"month":["2026-12-31T21:00:00.000Z","2027-01-31T21:00:00.000Z"]},"2026-11-25":{"mi":2,"blanks":6,"days":30,"first":"2026-11-01","last":"2026-11-30","week":["2026-11-23","2026-11-29"],"day":["2026-11-24T21:00:00.000Z","2026-11-25T21:00:00.000Z"],"weekR":["2026-11-22T21:00:00.000Z","2026-11-29T21:00:00.000Z"],"month":["2026-10-31T21:00:00.000Z","2026-11-30T21:00:00.000Z"]},"2026-11-29":{"mi":6,"blanks":6,"days":30,"first":"2026-11-01","last":"2026-11-30","week":["2026-11-23","2026-11-29"],"day":["2026-11-28T21:00:00.000Z","2026-11-29T21:00:00.000Z"],"weekR":["2026-11-22T21:00:00.000Z","2026-11-29T21:00:00.000Z"],"month":["2026-10-31T21:00:00.000Z","2026-11-30T21:00:00.000Z"]},"2026-11-23":{"mi":0,"blanks":6,"days":30,"first":"2026-11-01","last":"2026-11-30","week":["2026-11-23","2026-11-29"],"day":["2026-11-22T21:00:00.000Z","2026-11-23T21:00:00.000Z"],"weekR":["2026-11-22T21:00:00.000Z","2026-11-29T21:00:00.000Z"],"month":["2026-10-31T21:00:00.000Z","2026-11-30T21:00:00.000Z"]},"2024-09-01":{"mi":6,"blanks":6,"days":30,"first":"2024-09-01","last":"2024-09-30","week":["2024-08-26","2024-09-01"],"day":["2024-08-31T21:00:00.000Z","2024-09-01T21:00:00.000Z"],"weekR":["2024-08-25T21:00:00.000Z","2024-09-01T21:00:00.000Z"],"month":["2024-08-31T21:00:00.000Z","2024-09-30T21:00:00.000Z"]},"2024-07-01":{"mi":0,"blanks":0,"days":31,"first":"2024-07-01","last":"2024-07-31","week":["2024-07-01","2024-07-07"],"day":["2024-06-30T21:00:00.000Z","2024-07-01T21:00:00.000Z"],"weekR":["2024-06-30T21:00:00.000Z","2024-07-07T21:00:00.000Z"],"month":["2024-06-30T21:00:00.000Z","2024-07-31T21:00:00.000Z"]}} as Record<
  string,
  {
    mi: number
    blanks: number
    days: number
    first: string
    last: string
    week: [string, string]
    day: [string, string]
    weekR: [string, string]
    month: [string, string]
  }
>

const iso = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()]

describe("takvim ızgarası karakterizasyonu", () => {
  for (const [key, g] of Object.entries(GOLDEN)) {
    test(key, () => {
      const days = monthDayKeys(key)
      expect(mondayIndex(key)).toBe(g.mi)
      expect(monthLeadingBlanks(key)).toBe(g.blanks)
      expect(days).toHaveLength(g.days)
      expect(days[0]).toBe(g.first)
      expect(days.at(-1)).toBe(g.last)
      const week = weekDayKeys(key)
      expect([week[0], week[6]]).toEqual(g.week)
      expect(iso(calendarViewRange("day", key))).toEqual(g.day)
      expect(iso(calendarViewRange("week", key))).toEqual(g.weekR)
      expect(iso(calendarViewRange("month", key))).toEqual(g.month)
    })
  }
})
