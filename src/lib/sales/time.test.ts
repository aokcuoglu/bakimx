import { expect, test } from "bun:test"
import { istanbulDateTimeInputValue, istanbulDayBounds, istanbulMonthBounds, parseIstanbulLocalDateTime } from "./time"

test("sales agenda uses Europe/Istanbul day boundaries", () => {
  expect(istanbulDayBounds(new Date("2026-08-27T22:30:00.000Z"))).toEqual({
    start: new Date("2026-08-27T21:00:00.000Z"),
    end: new Date("2026-08-28T21:00:00.000Z"),
  })
  expect(istanbulDayBounds(new Date("2026-08-27T08:00:00.000Z"))).toEqual({
    start: new Date("2026-08-26T21:00:00.000Z"),
    end: new Date("2026-08-27T21:00:00.000Z"),
  })
})

test("hakediş yürürlük zamanı Europe/Istanbul duvar saatini UTC'ye çevirir", () => {
  expect(parseIstanbulLocalDateTime("2026-08-28T21:30")).toEqual(new Date("2026-08-28T18:30:00.000Z"))
  expect(istanbulDateTimeInputValue(new Date("2026-08-28T18:30:00.000Z"))).toBe("2026-08-28T21:30")
  expect(parseIstanbulLocalDateTime("geçersiz")).toBeNull()
})

test("satış performansı ay sınırlarını Europe/Istanbul takvimine göre kurar", () => {
  expect(istanbulMonthBounds("2026-08")).toEqual({
    key: "2026-08",
    label: "Ağustos 2026",
    start: new Date("2026-07-31T21:00:00.000Z"),
    end: new Date("2026-08-31T21:00:00.000Z"),
    previousKey: "2026-07",
    nextKey: "2026-09",
    dayCount: 31,
  })
  expect(istanbulMonthBounds("2026-01").previousKey).toBe("2025-12")
  expect(istanbulMonthBounds("2026-12").nextKey).toBe("2027-01")
})

test("geçersiz ay filtresi içinde bulunulan İstanbul ayına döner", () => {
  const now = new Date("2026-08-31T22:30:00.000Z")
  expect(istanbulMonthBounds("2026-13", now).key).toBe("2026-09")
  expect(istanbulMonthBounds(undefined, now).start).toEqual(new Date("2026-08-31T21:00:00.000Z"))
})
