import { describe, expect, test } from "bun:test"

import { daysUntil } from "@/lib/reminders/format"
import { deriveReminderStatus, getStatusFromDueDates } from "@/lib/reminders/status"

/**
 * #904 — hatırlatma durumu ve kalan gün Türkiye gününe göre. Beklentiler sabit
 * UTC anlarıyla yazılır; dosya sürecin `TZ`'sinden bağımsız geçmeli (TZ=UTC,
 * TZ=America/New_York, TZ=Asia/Tokyo ile de koşulur).
 *
 * `dueDate` formdan `YYYY-MM-DD` olarak gelir ve `new Date("YYYY-MM-DD")` ile
 * UTC gece yarısı (TR 03:00, aynı gün) olarak yazılır.
 */

// TR 26.11.2026 00:30 — UTC'de hâlâ 25.11.
const AFTER_TR_MIDNIGHT = new Date("2026-11-25T21:30:00.000Z")
// TR 25.11.2026 23:30
const BEFORE_TR_MIDNIGHT = new Date("2026-11-25T20:30:00.000Z")

describe("deriveReminderStatus", () => {
  test("regresyon #904: TR 26.11 00:30'da 25.11 son tarihli hatırlatma gecikmiştir", () => {
    // Eski kod süreç saatinde gün başı kuruyordu; TZ=UTC'de bugün hâlâ 25.11 sayılıp "upcoming" dönüyordu.
    expect(deriveReminderStatus({ dueDate: "2026-11-25T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("overdue")
    expect(deriveReminderStatus({ dueDate: new Date("2026-11-25") }, AFTER_TR_MIDNIGHT)).toBe("overdue")
  })

  test("son gün bugün ya da ileride ise gecikmiş değildir", () => {
    expect(deriveReminderStatus({ dueDate: "2026-11-26T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("upcoming")
    expect(deriveReminderStatus({ dueDate: "2026-11-25T00:00:00.000Z" }, BEFORE_TR_MIDNIGHT)).toBe("upcoming")
  })

  test("reminderDaysBefore: uyarı eşiği bugünden N Türkiye günü sonrası dahil", () => {
    const input = { reminderDaysBefore: 3 }
    expect(deriveReminderStatus({ ...input, dueDate: "2026-11-26T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("due_soon")
    expect(deriveReminderStatus({ ...input, dueDate: "2026-11-29T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("due_soon")
    expect(deriveReminderStatus({ ...input, dueDate: "2026-11-30T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("upcoming")
  })

  test("tamamlandı / ertelendi / iptal durumu tarihten bağımsız korunur", () => {
    const overdueDate = "2026-11-01T00:00:00.000Z"
    for (const status of ["completed", "postponed", "cancelled"] as const) {
      expect(deriveReminderStatus({ status, dueDate: overdueDate }, AFTER_TR_MIDNIGHT)).toBe(status)
    }
  })

  test("kilometre: aşıldıysa gecikmiş, eşikteyse yaklaşıyor", () => {
    expect(deriveReminderStatus({ dueMileage: 100_000, currentMileage: 100_000 }, AFTER_TR_MIDNIGHT)).toBe("overdue")
    expect(
      deriveReminderStatus({ dueMileage: 100_000, currentMileage: 99_000, reminderKmBefore: 1_000 }, AFTER_TR_MIDNIGHT)
    ).toBe("due_soon")
    expect(
      deriveReminderStatus({ dueMileage: 100_000, currentMileage: 98_000, reminderKmBefore: 1_000 }, AFTER_TR_MIDNIGHT)
    ).toBe("upcoming")
    expect(deriveReminderStatus({ dueMileage: 100_000, currentMileage: null }, AFTER_TR_MIDNIGHT)).toBe("upcoming")
  })

  test("kilometre aşımı ileri tarihli hatırlatmayı da gecikmiş yapar", () => {
    expect(
      deriveReminderStatus(
        { dueDate: "2026-12-31T00:00:00.000Z", dueMileage: 100_000, currentMileage: 100_500 },
        AFTER_TR_MIDNIGHT
      )
    ).toBe("overdue")
  })

  test("geçersiz tarih dizesi yaklaşan sayılır", () => {
    expect(deriveReminderStatus({ dueDate: "tarih-değil" }, AFTER_TR_MIDNIGHT)).toBe("upcoming")
  })
})

describe("getStatusFromDueDates", () => {
  test("verilen anı deriveReminderStatus'a geçirir", () => {
    expect(getStatusFromDueDates({ dueDate: "2026-11-25T00:00:00.000Z" }, AFTER_TR_MIDNIGHT)).toBe("overdue")
    expect(getStatusFromDueDates({ dueDate: "2026-11-25T00:00:00.000Z" }, BEFORE_TR_MIDNIGHT)).toBe("upcoming")
  })
})

describe("daysUntil", () => {
  test("TR gece yarısından sonra: bugün 0, yarın 1, dün -1", () => {
    expect(daysUntil("2026-11-26T00:00:00.000Z", AFTER_TR_MIDNIGHT)).toBe(0)
    expect(daysUntil("2026-11-27T00:00:00.000Z", AFTER_TR_MIDNIGHT)).toBe(1)
    expect(daysUntil("2026-11-25T00:00:00.000Z", AFTER_TR_MIDNIGHT)).toBe(-1)
  })

  test("TR gece yarısından önce: aynı son tarihler bir gün kayar", () => {
    expect(daysUntil(new Date("2026-11-25"), BEFORE_TR_MIDNIGHT)).toBe(0)
    expect(daysUntil(new Date("2026-11-26"), BEFORE_TR_MIDNIGHT)).toBe(1)
  })
})
