import { describe, expect, test } from "bun:test"
import { isDayKey, parseCalendarViewMode } from "./calendar-grid"
import { calendarHref, shiftCalendarDay } from "./calendar-navigation"

describe("calendarHref", () => {
  test("her üç görünümde view ve date yazar", () => {
    expect(calendarHref("day", "2026-03-10")).toBe("/calendar?view=day&date=2026-03-10")
    expect(calendarHref("week", "2026-03-10")).toBe("/calendar?view=week&date=2026-03-10")
    expect(calendarHref("month", "2026-03-10")).toBe("/calendar?view=month&date=2026-03-10")
  })

  test("üretilen parametreler sayfanın ayrıştırıcılarından geçer", () => {
    for (const view of ["day", "week", "month"] as const) {
      const params = new URL(calendarHref(view, "2026-03-10"), "http://x").searchParams
      expect(parseCalendarViewMode(params.get("view") ?? undefined)).toBe(view)
      expect(isDayKey(params.get("date") ?? "")).toBe(true)
    }
  })
})

describe("shiftCalendarDay", () => {
  test("gün: ay ve yıl sınırını geçer", () => {
    expect(shiftCalendarDay("day", "2026-12-31", "next")).toBe("2027-01-01")
    expect(shiftCalendarDay("day", "2026-03-01", "prev")).toBe("2026-02-28")
  })

  test("hafta: 7 gün", () => {
    expect(shiftCalendarDay("week", "2026-03-10", "next")).toBe("2026-03-17")
    expect(shiftCalendarDay("week", "2026-03-10", "prev")).toBe("2026-03-03")
  })

  test("ay: kısa aya sıkışır", () => {
    expect(shiftCalendarDay("month", "2026-01-31", "next")).toBe("2026-02-28")
    expect(shiftCalendarDay("month", "2026-03-31", "prev")).toBe("2026-02-28")
  })

  test("desteklenen aralığın dışına çıkmaz", () => {
    expect(shiftCalendarDay("month", "2100-12-15", "next")).toBe("2100-12-15")
    expect(shiftCalendarDay("day", "1970-01-01", "prev")).toBe("1970-01-01")
  })
})
