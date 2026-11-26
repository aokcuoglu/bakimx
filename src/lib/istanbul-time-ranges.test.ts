import { describe, expect, test } from "bun:test"

import {
  istanbulDateRange,
  istanbulDayStart,
  istanbulWeekStart,
  parseIstanbulDate,
} from "./istanbul-time"

const iso = (date: Date | null | undefined) => date?.toISOString()
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * #906 — kullanıcının seçtiği `YYYY-MM-DD` günü İstanbul gece yarısıdır, UTC
 * gece yarısı değil. Beklenen değerler sabit UTC anlarıdır; test sürecin
 * `TZ`'sinden bağımsız geçmelidir (UTC / America/New_York / Asia/Tokyo).
 */
describe("parseIstanbulDate", () => {
  test("YYYY-MM-DD → o İstanbul gününün 00:00'ı (UTC'de önceki gün 21:00)", () => {
    expect(iso(parseIstanbulDate("2026-11-25"))).toBe("2026-11-24T21:00:00.000Z")
  })

  test("yılbaşı: 2027-01-01 → 2026-12-31T21:00Z", () => {
    expect(iso(parseIstanbulDate("2027-01-01"))).toBe("2026-12-31T21:00:00.000Z")
  })

  test("artık yıl: 2028-02-29 geçerli, 2027-02-29 değil", () => {
    expect(iso(parseIstanbulDate("2028-02-29"))).toBe("2028-02-28T21:00:00.000Z")
    expect(parseIstanbulDate("2027-02-29")).toBeNull()
  })

  for (const value of [
    "",
    "2026-02-31",
    "2026-13-01",
    "2026-00-10",
    "2026-11-00",
    "25.11.2026",
    "2026-11-25T09:00",
    "2026-1-5",
    " 2026-11-25",
    "abcd-ef-gh",
  ]) {
    test(`geçersiz: ${JSON.stringify(value)} → null`, () => {
      expect(parseIstanbulDate(value)).toBeNull()
    })
  }
})

/** #905 — hafta Pazartesi başlar ve İstanbul gününe göre hesaplanır. */
describe("istanbulWeekStart", () => {
  test("Pazartesi TR 00:30 (UTC'de Pazar 21:30) kendi haftasının başıdır", () => {
    // 2026-11-30 Pazartesi TR 00:30.
    const now = new Date("2026-11-29T21:30:00.000Z")
    expect(iso(istanbulWeekStart(now))).toBe("2026-11-29T21:00:00.000Z")
  })

  test("Pazar TR 23:30 önceki Pazartesi'nin haftasındadır", () => {
    // 2026-11-29 Pazar TR 23:30 — hafta 2026-11-23 Pazartesi başlar.
    const now = new Date("2026-11-29T20:30:00.000Z")
    expect(iso(istanbulWeekStart(now))).toBe("2026-11-22T21:00:00.000Z")
  })

  test("hafta ortası: Çarşamba → aynı haftanın Pazartesi'si", () => {
    // 2026-11-25 Çarşamba TR 12:00.
    const now = new Date("2026-11-25T09:00:00.000Z")
    expect(iso(istanbulWeekStart(now))).toBe("2026-11-22T21:00:00.000Z")
  })

  test("offsetWeeks -1 ve +1 ay sınırını aşar", () => {
    // 2026-12-02 Çarşamba TR 10:00 — bu hafta 30 Kasım Pazartesi başlar.
    const now = new Date("2026-12-02T07:00:00.000Z")
    expect(iso(istanbulWeekStart(now))).toBe("2026-11-29T21:00:00.000Z")
    expect(iso(istanbulWeekStart(now, -1))).toBe("2026-11-22T21:00:00.000Z")
    expect(iso(istanbulWeekStart(now, 1))).toBe("2026-12-06T21:00:00.000Z")
  })

  test("offsetWeeks -1 ve +1 yıl sınırını aşar", () => {
    // 2027-01-01 Cuma TR 01:00 (UTC'de hâlâ 2026-12-31) — hafta 28 Aralık Pazartesi.
    const now = new Date("2026-12-31T22:00:00.000Z")
    expect(iso(istanbulWeekStart(now))).toBe("2026-12-27T21:00:00.000Z")
    expect(iso(istanbulWeekStart(now, -1))).toBe("2026-12-20T21:00:00.000Z")
    expect(iso(istanbulWeekStart(now, 1))).toBe("2027-01-03T21:00:00.000Z")
  })

  test("hafta başı her zaman bir İstanbul gün başıdır ve tam 7 gün sürer", () => {
    const now = new Date("2026-11-25T09:00:00.000Z")
    const start = istanbulWeekStart(now)
    expect(start).toEqual(istanbulDayStart(start))
    expect(istanbulWeekStart(now, 1).getTime() - start.getTime()).toBe(7 * DAY_MS)
  })
})

/** #906 — `dateFrom`/`dateTo` ikisi de dahil → `[start, end)`. */
describe("istanbulDateRange", () => {
  test("aynı gün başlangıç ve bitiş = tam 24 saat", () => {
    const { start, end } = istanbulDateRange("2026-11-25", "2026-11-25")
    expect(iso(start)).toBe("2026-11-24T21:00:00.000Z")
    expect(iso(end)).toBe("2026-11-25T21:00:00.000Z")
    expect(end!.getTime() - start!.getTime()).toBe(DAY_MS)
  })

  test("bitiş günü dahil: TR 00:30 ve 23:59 içeride, ertesi gün TR 00:00 dışarıda", () => {
    const { start, end } = istanbulDateRange("2026-11-20", "2026-11-25")
    const inside = (at: Date) => at >= start! && at < end!
    // 25.11 TR 00:30 — UTC'de hâlâ 24.11; eski `new Date("2026-11-25")` bunu kaçırıyordu.
    expect(inside(new Date("2026-11-24T21:30:00.000Z"))).toBe(true)
    // 25.11 TR 23:59.
    expect(inside(new Date("2026-11-25T20:59:00.000Z"))).toBe(true)
    // 26.11 TR 00:00 — bitiş gününün ertesi.
    expect(inside(new Date("2026-11-25T21:00:00.000Z"))).toBe(false)
    // 20.11 TR 00:00 dahil, 19.11 TR 23:59 değil.
    expect(inside(new Date("2026-11-19T21:00:00.000Z"))).toBe(true)
    expect(inside(new Date("2026-11-19T20:59:00.000Z"))).toBe(false)
  })

  test("boş ya da geçersiz taraf undefined", () => {
    expect(istanbulDateRange()).toEqual({ start: undefined, end: undefined })
    expect(istanbulDateRange("", null)).toEqual({ start: undefined, end: undefined })
    expect(istanbulDateRange("2026-02-31", "2026-11-25").start).toBeUndefined()
    expect(iso(istanbulDateRange("2026-02-31", "2026-11-25").end)).toBe("2026-11-25T21:00:00.000Z")
    expect(iso(istanbulDateRange("2026-11-25", "bozuk").start)).toBe("2026-11-24T21:00:00.000Z")
    expect(istanbulDateRange("2026-11-25", "bozuk").end).toBeUndefined()
  })

  test("başlangıç bitişten sonraysa ters çevrilmez (boş aralık)", () => {
    const { start, end } = istanbulDateRange("2026-11-25", "2026-11-20")
    expect(iso(start)).toBe("2026-11-24T21:00:00.000Z")
    expect(iso(end)).toBe("2026-11-20T21:00:00.000Z")
  })
})
