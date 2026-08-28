import { expect, test } from "bun:test"
import { istanbulDateTimeInputValue, istanbulDayBounds, parseIstanbulLocalDateTime } from "./time"

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
