import { describe, expect, test } from "bun:test"

import { resolveReminderDueWindow, type ReminderDueWindow } from "@/lib/reminders/date-filter"

/**
 * #904 — hatırlatma listesindeki "Bugün / Bu hafta / Bu ay" filtresi Türkiye
 * gününe göre. Beklentiler sabit UTC anlarıyla yazılır; dosya sürecin `TZ`'sinden
 * bağımsız geçmeli (TZ=UTC, TZ=America/New_York, TZ=Asia/Tokyo ile de koşulur).
 *
 * `dueDate` formdan `YYYY-MM-DD` olarak gelir ve `new Date("YYYY-MM-DD")` ile
 * UTC gece yarısı (TR 03:00, aynı gün) olarak yazılır.
 */

// TR 26.11.2026 10:00
const NOW = new Date("2026-11-26T07:00:00.000Z")

function inWindow(window: ReminderDueWindow | null, at: Date): boolean {
  return window !== null && at >= window.gte && at < window.lt
}

/** Formdan gelen `YYYY-MM-DD` son tarihinin veritabanındaki hâli. */
const due = (day: string) => new Date(day)

describe("resolveReminderDueWindow", () => {
  test("bugün: Türkiye gün başından ertesi gün başına", () => {
    expect(resolveReminderDueWindow("today", NOW)).toEqual({
      gte: new Date("2026-11-25T21:00:00.000Z"),
      lt: new Date("2026-11-26T21:00:00.000Z"),
    })
  })

  test("bu hafta: bugün dahil kayan 7 gün", () => {
    expect(resolveReminderDueWindow("week", NOW)).toEqual({
      gte: new Date("2026-11-25T21:00:00.000Z"),
      lt: new Date("2026-12-02T21:00:00.000Z"),
    })
  })

  test("bu ay: bugün dahil kayan 30 gün", () => {
    expect(resolveReminderDueWindow("month", NOW)).toEqual({
      gte: new Date("2026-11-25T21:00:00.000Z"),
      lt: new Date("2026-12-25T21:00:00.000Z"),
    })
  })

  test("gecikmiş, boş ya da tanınmayan değer pencere değildir", () => {
    expect(resolveReminderDueWindow("overdue", NOW)).toBeNull()
    expect(resolveReminderDueWindow("", NOW)).toBeNull()
    expect(resolveReminderDueWindow("tomorrow", NOW)).toBeNull()
  })

  test("pencerenin son günü dahil, ertesi gün hariç", () => {
    expect(inWindow(resolveReminderDueWindow("today", NOW), due("2026-11-26"))).toBe(true)
    expect(inWindow(resolveReminderDueWindow("today", NOW), due("2026-11-27"))).toBe(false)
    expect(inWindow(resolveReminderDueWindow("week", NOW), due("2026-12-02"))).toBe(true)
    expect(inWindow(resolveReminderDueWindow("week", NOW), due("2026-12-03"))).toBe(false)
    expect(inWindow(resolveReminderDueWindow("month", NOW), due("2026-12-25"))).toBe(true)
    expect(inWindow(resolveReminderDueWindow("month", NOW), due("2026-12-26"))).toBe(false)
  })

  test("regresyon #904: TR 26.11 00:30'da bugün 26.11'dir, 25.11 değil", () => {
    // UTC'de hâlâ 25.11; süreç saatinde gece yarısı kuran eski kod bugünü 25.11 sayıyordu.
    const now = new Date("2026-11-25T21:30:00.000Z")
    const today = resolveReminderDueWindow("today", now)

    expect(inWindow(today, due("2026-11-26"))).toBe(true)
    expect(inWindow(today, due("2026-11-25"))).toBe(false)
    expect(inWindow(resolveReminderDueWindow("week", now), due("2026-11-25"))).toBe(false)
  })
})
