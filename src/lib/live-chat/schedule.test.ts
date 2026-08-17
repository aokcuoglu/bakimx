import { describe, expect, test } from "bun:test"
import {
  DEFAULT_SCHEDULE,
  addDays,
  describeNextOpening,
  evaluateAvailability,
  parseHolidayList,
  parseWeeklySchedule,
  scheduleSummary,
  toMinutes,
  zonedNow,
  type AvailabilityInput,
} from "./schedule"

const BASE: AvailabilityInput = {
  enabled: true,
  timezone: "Europe/Istanbul",
  schedule: DEFAULT_SCHEDULE,
  holidays: [],
}

/** UTC anı üretir; Türkiye UTC+3 olduğu için duvar saati +3'tür. */
function utc(iso: string): Date {
  return new Date(iso)
}

describe("zonedNow", () => {
  test("UTC anını hedef saat dilimine çevirir", () => {
    // 2026-08-17 06:30Z = İstanbul'da Pazartesi 09:30
    const z = zonedNow(utc("2026-08-17T06:30:00Z"), "Europe/Istanbul")
    expect(z.dayKey).toBe("mon")
    expect(z.minutes).toBe(9 * 60 + 30)
    expect(z.ymd).toBe("2026-08-17")
  })

  test("gün sınırını saat dilimine göre kaydırır", () => {
    // 2026-08-17 22:00Z = İstanbul'da 18 Ağustos Salı 01:00
    const z = zonedNow(utc("2026-08-17T22:00:00Z"), "Europe/Istanbul")
    expect(z.dayKey).toBe("tue")
    expect(z.ymd).toBe("2026-08-18")
    expect(z.minutes).toBe(60)
  })

  test("gece yarısı 24 değil 0 dakikadır", () => {
    const z = zonedNow(utc("2026-08-17T21:00:00Z"), "Europe/Istanbul")
    expect(z.minutes).toBe(0)
    expect(z.ymd).toBe("2026-08-18")
  })

  test("geçersiz saat dilimi UTC'ye düşer, patlamaz", () => {
    const z = zonedNow(utc("2026-08-17T06:30:00Z"), "Mars/Olympus")
    expect(z.ymd).toBe("2026-08-17")
    expect(z.minutes).toBe(6 * 60 + 30)
  })
})

describe("evaluateAvailability", () => {
  test("çalışma saati içinde çevrimiçi", () => {
    const a = evaluateAvailability(BASE, utc("2026-08-17T09:00:00Z")) // Pzt 12:00
    expect(a.online).toBe(true)
    expect(a.reason).toBe("online")
    expect(a.nextOpening).toBeNull()
  })

  test("açılıştan bir dakika önce kapalı, açılışta açık", () => {
    expect(evaluateAvailability(BASE, utc("2026-08-17T05:59:00Z")).online).toBe(false)
    expect(evaluateAvailability(BASE, utc("2026-08-17T06:00:00Z")).online).toBe(true)
  })

  test("bitiş saati dışlayıcıdır (18:00'da kapalı)", () => {
    expect(evaluateAvailability(BASE, utc("2026-08-17T14:59:00Z")).online).toBe(true)
    expect(evaluateAvailability(BASE, utc("2026-08-17T15:00:00Z")).online).toBe(false)
  })

  test("mesai öncesi aynı günü, mesai sonrası ertesi günü işaret eder", () => {
    const before = evaluateAvailability(BASE, utc("2026-08-17T04:00:00Z")) // Pzt 07:00
    expect(before.nextOpening?.daysAhead).toBe(0)

    const after = evaluateAvailability(BASE, utc("2026-08-17T16:00:00Z")) // Pzt 19:00
    expect(after.nextOpening?.daysAhead).toBe(1)
    expect(after.nextOpening?.dayKey).toBe("tue")
  })

  test("kapalı gün (Pazar) sonraki açık günü bulur", () => {
    const a = evaluateAvailability(BASE, utc("2026-08-16T09:00:00Z")) // Pazar 12:00
    expect(a.online).toBe(false)
    expect(a.reason).toBe("day_off")
    expect(a.nextOpening?.dayKey).toBe("mon")
    expect(a.nextOpening?.daysAhead).toBe(1)
  })

  test("Cumartesi kendi penceresini kullanır", () => {
    expect(evaluateAvailability(BASE, utc("2026-08-15T08:00:00Z")).online).toBe(true) // Cmt 11:00
    expect(evaluateAvailability(BASE, utc("2026-08-15T12:00:00Z")).online).toBe(false) // Cmt 15:00
  })

  test("tatil günü mesai içinde bile kapatır ve o günü atlar", () => {
    const input = { ...BASE, holidays: ["2026-08-17"] }
    const a = evaluateAvailability(input, utc("2026-08-17T09:00:00Z"))
    expect(a.online).toBe(false)
    expect(a.reason).toBe("holiday")
    expect(a.nextOpening?.ymd).toBe("2026-08-18")
  })

  test("enabled=false her şeyi kapatır ve sonraki açılış vaat etmez", () => {
    const a = evaluateAvailability({ ...BASE, enabled: false }, utc("2026-08-17T09:00:00Z"))
    expect(a.online).toBe(false)
    expect(a.reason).toBe("disabled")
    expect(a.nextOpening).toBeNull()
  })

  test("tüm günler kapalıysa sonraki açılış null'dır (sonsuz döngü yok)", () => {
    const allOff = parseWeeklySchedule(
      Object.fromEntries(Object.keys(DEFAULT_SCHEDULE).map((k) => [k, { enabled: false, start: "09:00", end: "18:00" }])),
    )
    const a = evaluateAvailability({ ...BASE, schedule: allOff }, utc("2026-08-17T09:00:00Z"))
    expect(a.online).toBe(false)
    expect(a.nextOpening).toBeNull()
  })
})

describe("parseWeeklySchedule", () => {
  test("null/bozuk girdi varsayılana düşer", () => {
    expect(parseWeeklySchedule(null)).toEqual(DEFAULT_SCHEDULE)
    expect(parseWeeklySchedule("nope")).toEqual(DEFAULT_SCHEDULE)
    expect(parseWeeklySchedule([1, 2])).toEqual(DEFAULT_SCHEDULE)
  })

  test("kısmi girdide yalnız verilen gün değişir", () => {
    const parsed = parseWeeklySchedule({ mon: { enabled: true, start: "08:00", end: "20:00" } })
    expect(parsed.mon).toEqual({ enabled: true, start: "08:00", end: "20:00" })
    expect(parsed.tue).toEqual(DEFAULT_SCHEDULE.tue)
  })

  test("geçersiz saat ve ters aralık o günün varsayılanına düşer", () => {
    expect(parseWeeklySchedule({ mon: { enabled: true, start: "25:00", end: "18:00" } }).mon.start).toBe("09:00")
    expect(parseWeeklySchedule({ mon: { enabled: true, start: "20:00", end: "08:00" } }).mon).toEqual(
      DEFAULT_SCHEDULE.mon,
    )
  })
})

describe("yardımcılar", () => {
  test("toMinutes geçersiz saate null döner", () => {
    expect(toMinutes("09:30")).toBe(570)
    expect(toMinutes("9:30")).toBeNull()
    expect(toMinutes("24:00")).toBeNull()
  })

  test("addDays ay ve yıl sınırını geçer", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  test("parseHolidayList temizler, tekilleştirir, sıralar", () => {
    expect(parseHolidayList("2026-04-23, bozuk , 2026-01-01\n2026-04-23, 2026-13-40")).toEqual([
      "2026-01-01",
      "2026-04-23",
    ])
  })

  test("describeNextOpening bugün/yarın/gün adı ayırır", () => {
    expect(describeNextOpening(null)).toBeNull()
    expect(
      describeNextOpening({ dayKey: "mon", dayLabel: "Pazartesi", time: "09:00", daysAhead: 0, ymd: "2026-08-17" }),
    ).toContain("Bugün")
    expect(
      describeNextOpening({ dayKey: "tue", dayLabel: "Salı", time: "09:00", daysAhead: 1, ymd: "2026-08-18" }),
    ).toContain("Yarın")
    expect(
      describeNextOpening({ dayKey: "thu", dayLabel: "Perşembe", time: "09:00", daysAhead: 3, ymd: "2026-08-20" }),
    ).toContain("Perşembe")
  })

  test("scheduleSummary Pazartesi'den başlar ve kapalı günü işaretler", () => {
    const rows = scheduleSummary(DEFAULT_SCHEDULE)
    expect(rows[0].dayKey).toBe("mon")
    expect(rows[6].dayKey).toBe("sun")
    expect(rows[6].text).toBe("Kapalı")
    expect(rows[0].text).toBe("09:00 – 18:00")
  })
})
