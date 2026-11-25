import { describe, expect, test } from "bun:test"

import { appointmentTodayBounds, resolveAppointmentDateWindow } from "@/lib/appointments/date-filter"

/**
 * #874 — randevu "Bugün / Yarın / Bu hafta" filtresi Türkiye gününe göre.
 * Beklentiler sabit UTC anlarıyla yazılır; dosya sürecin `TZ`'sinden bağımsız
 * geçmeli (TZ=UTC ve TZ=America/New_York ile de koşulur).
 */

// TR 26.11.2026 10:00
const NOW = new Date("2026-11-26T07:00:00.000Z")

function inWindow(window: { gte: Date; lt: Date } | null, at: Date): boolean {
  return window !== null && at >= window.gte && at < window.lt
}

describe("resolveAppointmentDateWindow", () => {
  test("bugün: Türkiye gün başından ertesi gün başına", () => {
    expect(resolveAppointmentDateWindow("today", NOW)).toEqual({
      gte: new Date("2026-11-25T21:00:00.000Z"),
      lt: new Date("2026-11-26T21:00:00.000Z"),
    })
  })

  test("yarın: ertesi Türkiye günü", () => {
    expect(resolveAppointmentDateWindow("tomorrow", NOW)).toEqual({
      gte: new Date("2026-11-26T21:00:00.000Z"),
      lt: new Date("2026-11-27T21:00:00.000Z"),
    })
  })

  test("bu hafta: bugün dahil kayan 7 gün, ay sonunu aşar", () => {
    expect(resolveAppointmentDateWindow("week", NOW)).toEqual({
      gte: new Date("2026-11-25T21:00:00.000Z"),
      lt: new Date("2026-12-02T21:00:00.000Z"),
    })
  })

  test("tanınmayan ya da boş değer tarih filtresi değildir", () => {
    expect(resolveAppointmentDateWindow("all", NOW)).toBeNull()
    expect(resolveAppointmentDateWindow("", NOW)).toBeNull()
    expect(resolveAppointmentDateWindow("yarin", NOW)).toBeNull()
  })

  test("regresyon #874: TR 26.11 01:30 randevusu 26.11 boyunca bugündür, 25.11'de yarındır", () => {
    // TR 26.11.2026 01:30 — UTC'de hâlâ 25.11.
    const appointmentAt = new Date("2026-11-25T22:30:00.000Z")

    const sameDayNows = [
      "2026-11-25T21:00:00.000Z", // TR 26.11 00:00
      "2026-11-25T21:30:00.000Z", // TR 26.11 00:30
      "2026-11-26T07:00:00.000Z", // TR 26.11 10:00
      "2026-11-26T20:59:59.999Z", // TR 26.11 23:59
    ]
    for (const now of sameDayNows) {
      expect(inWindow(resolveAppointmentDateWindow("today", new Date(now)), appointmentAt)).toBe(true)
      expect(inWindow(resolveAppointmentDateWindow("tomorrow", new Date(now)), appointmentAt)).toBe(false)
    }

    // TR 25.11 20:00
    const dayBefore = new Date("2026-11-25T17:00:00.000Z")
    expect(inWindow(resolveAppointmentDateWindow("tomorrow", dayBefore), appointmentAt)).toBe(true)
    expect(inWindow(resolveAppointmentDateWindow("today", dayBefore), appointmentAt)).toBe(false)
  })
})

describe("appointmentTodayBounds", () => {
  test("sayaç sınırları bugün filtresiyle aynı", () => {
    const window = resolveAppointmentDateWindow("today", NOW)
    expect(appointmentTodayBounds(NOW)).toEqual({ today: window!.gte, tomorrow: window!.lt })
  })

  test("yıl sonunda yarın bir sonraki yılın ilk günüdür", () => {
    // TR 31.12.2026 23:30
    expect(appointmentTodayBounds(new Date("2026-12-31T20:30:00.000Z"))).toEqual({
      today: new Date("2026-12-30T21:00:00.000Z"),
      tomorrow: new Date("2026-12-31T21:00:00.000Z"),
    })
  })
})
