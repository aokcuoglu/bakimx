import { describe, expect, test } from "bun:test"
import { ALL_DAY_LABEL, compareCalendarItems, eventStartLabel, eventTimeRangeLabel } from "./event-time"

// Hatırlatma dueDate'i UTC gece yarısı: İstanbul'da 03:00 (#903).
const reminder = { startAt: "2026-11-26T00:00:00.000Z", allDay: true }
const appointment = { startAt: "2026-11-26T06:00:00.000Z", endAt: "2026-11-26T07:30:00.000Z" }

describe("event-time", () => {
  test("tüm gün etkinlik saat değil 'Tüm gün' yazar", () => {
    expect(eventStartLabel(reminder)).toBe(ALL_DAY_LABEL)
    expect(eventTimeRangeLabel(reminder)).toBe(ALL_DAY_LABEL)
    expect(eventStartLabel(reminder)).not.toContain("03:00")
  })

  test("saatli randevu değişmez", () => {
    expect(eventStartLabel(appointment)).toBe("09:00")
    expect(eventTimeRangeLabel(appointment)).toBe("09:00 — 10:30")
    expect(eventTimeRangeLabel({ startAt: appointment.startAt })).toBe("09:00")
  })

  test("aynı gün içinde tüm gün etkinlik saatlilerin önünde, günler kronolojik", () => {
    const earlyAppointment = { startAt: "2026-11-25T23:30:00.000Z" } // TR 02:30, aynı gün
    const nextDay = { startAt: "2026-11-26T21:30:00.000Z" } // TR 27'si 00:30
    const sorted = [nextDay, appointment, earlyAppointment, reminder].sort(compareCalendarItems)
    expect(sorted).toEqual([reminder, earlyAppointment, appointment, nextDay])
  })
})
