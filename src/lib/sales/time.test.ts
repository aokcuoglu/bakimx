import { expect, test } from "bun:test"
import { istanbulDayBounds } from "./time"

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
