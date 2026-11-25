// Saat diliminden bağımsız olmalı; şu komutlarla da koşturulur:
//   TZ=UTC bun test src/lib/calendar/calendar-grid.test.ts
//   TZ=America/New_York bun test src/lib/calendar/calendar-grid.test.ts
//   TZ=Asia/Tokyo bun test src/lib/calendar/calendar-grid.test.ts
import { describe, expect, test } from "bun:test"
import {
  addDays,
  addMonths,
  calendarViewRange,
  dayKeysInView,
  dayOfMonth,
  formatDayHeading,
  formatDayTitle,
  formatMonthTitle,
  formatWeekdayName,
  groupByIstanbulDay,
  isDayKey,
  istanbulTodayKey,
  mondayIndex,
  monthDayKeys,
  monthLeadingBlanks,
  parseCalendarViewMode,
  resolveDayKey,
  weekDayKeys,
} from "./calendar-grid"

describe("groupByIstanbulDay", () => {
  test("etkinlikler İstanbul gününe düşer", () => {
    const grouped = groupByIstanbulDay([
      { startAt: "2026-11-24T22:30:00.000Z" },
      { startAt: "2026-11-25T06:00:00.000Z" },
      { startAt: "2026-11-25T21:00:00.000Z" },
    ])
    expect(grouped["2026-11-25"]).toHaveLength(2)
    expect(grouped["2026-11-26"]).toHaveLength(1)
    expect(grouped["2026-11-24"]).toBeUndefined()
  })

  test("geçersiz tarih atlanır", () => {
    expect(groupByIstanbulDay([{ startAt: "bozuk" }])).toEqual({})
  })
})

describe("gün aritmetiği", () => {
  test("istanbulTodayKey", () => {
    expect(istanbulTodayKey(new Date("2026-11-24T21:30:00.000Z"))).toBe("2026-11-25")
  })
  test("addDays", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2026-11-25", 1)).toBe("2026-11-26")
  })
  test("addMonths ay sonunu sıkıştırır", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15")
    expect(addMonths("2026-01-10", -1)).toBe("2025-12-10")
  })
  test("dayOfMonth", () => {
    expect(dayOfMonth("2026-11-05")).toBe(5)
  })
})

describe("hafta ve ay", () => {
  test("mondayIndex", () => {
    expect(mondayIndex("2026-11-23")).toBe(0)
    expect(mondayIndex("2026-11-29")).toBe(6)
  })
  test("weekDayKeys Pazartesi başlar", () => {
    const week = weekDayKeys("2026-11-25")
    expect(week).toHaveLength(7)
    expect(week[0]).toBe("2026-11-23")
    expect(week[6]).toBe("2026-11-29")
    expect(weekDayKeys("2026-11-29")).toEqual(week)
  })
  test("monthDayKeys ve boşluklar", () => {
    const days = monthDayKeys("2026-11-25")
    expect(days).toHaveLength(30)
    expect(days[0]).toBe("2026-11-01")
    expect(monthLeadingBlanks("2026-11-25")).toBe(6)
    expect(monthDayKeys("2028-02-10")).toHaveLength(29)
  })
  test("dayKeysInView", () => {
    expect(dayKeysInView("day", "2026-11-25")).toEqual(["2026-11-25"])
    expect(dayKeysInView("week", "2026-11-25")).toHaveLength(7)
    expect(dayKeysInView("month", "2026-11-25")).toHaveLength(30)
  })
})

describe("calendarViewRange", () => {
  const iso = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()]
  test("gün", () => {
    expect(iso(calendarViewRange("day", "2026-11-25"))).toEqual([
      "2026-11-24T21:00:00.000Z",
      "2026-11-25T21:00:00.000Z",
    ])
  })
  test("hafta", () => {
    expect(iso(calendarViewRange("week", "2026-11-25"))).toEqual([
      "2026-11-22T21:00:00.000Z",
      "2026-11-29T21:00:00.000Z",
    ])
  })
  test("ay", () => {
    expect(iso(calendarViewRange("month", "2026-11-25"))).toEqual([
      "2026-10-31T21:00:00.000Z",
      "2026-11-30T21:00:00.000Z",
    ])
  })
})

describe("uç yıllar", () => {
  test("geçerli sınır anahtarı aralık hesabında patlamaz", () => {
    for (const view of ["day", "week", "month"] as const) {
      expect(() => calendarViewRange(view, "2100-12-31")).not.toThrow()
      expect(() => calendarViewRange(view, "1970-01-01")).not.toThrow()
    }
  })
})

describe("girdi çözümleme", () => {
  test("isDayKey", () => {
    expect(isDayKey("2026-11-25")).toBe(true)
    expect(isDayKey("2026-02-31")).toBe(false)
    expect(isDayKey("abc")).toBe(false)
    expect(isDayKey("9999-12-31")).toBe(false)
    expect(isDayKey("0100-01-01")).toBe(false)
  })
  test("resolveDayKey geçersizde İstanbul bugününe döner", () => {
    const now = new Date("2026-11-24T21:30:00.000Z")
    expect(resolveDayKey("2026-11-10", now)).toBe("2026-11-10")
    expect(resolveDayKey("2026-02-31", now)).toBe("2026-11-25")
    expect(resolveDayKey("abc", now)).toBe("2026-11-25")
    expect(resolveDayKey(undefined, now)).toBe("2026-11-25")
    expect(resolveDayKey("9999-12-31", now)).toBe("2026-11-25")
    expect(resolveDayKey("0100-01-01", now)).toBe("2026-11-25")
  })
  test("parseCalendarViewMode", () => {
    expect(parseCalendarViewMode("x")).toBe("week")
    expect(parseCalendarViewMode(undefined)).toBe("week")
    expect(parseCalendarViewMode("month")).toBe("month")
  })
})

describe("etiketler", () => {
  test("gün, ay ve başlık", () => {
    expect(formatWeekdayName("2026-11-25")).toBe("Çarşamba")
    expect(formatMonthTitle("2026-11-25")).toBe("Kasım 2026")
    expect(formatDayTitle("2026-11-25")).toContain("25 Kasım 2026")
    expect(formatDayTitle("2026-11-25")).toStartWith("Çarşamba, ")
    expect(formatDayHeading("2026-11-25")).toContain("25 Kasım 2026")
  })
})
