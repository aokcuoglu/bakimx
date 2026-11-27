import { describe, expect, test } from "bun:test"

import { planReminderStatusAging } from "@/lib/reminders/aging"

// TR 26.11.2026 00:30 (UTC'de hâlâ 25.11) ve TR 25.11.2026 23:30
const AFTER_TR_MIDNIGHT = new Date("2026-11-25T21:30:00.000Z")
const BEFORE_TR_MIDNIGHT = new Date("2026-11-25T20:30:00.000Z")

const base = { workshopId: "w1", dueMileage: null, currentMileage: null, reminderDaysBefore: null, reminderKmBefore: null }

function plan(rows: Parameters<typeof planReminderStatusAging>[0], now: Date) {
  return Object.fromEntries([...planReminderStatusAging(rows, now)].map(([k, v]) => [k, v.map((r) => r.id)]))
}

describe("planReminderStatusAging (#932)", () => {
  test("İstanbul gün sınırı: eski (00:00Z) ve yeni (21:00Z) 25.11 kaydı TR 26.11 00:30'da gecikir", () => {
    const rows = [
      { ...base, id: "legacy", status: "upcoming", dueDate: new Date("2026-11-25T00:00:00.000Z") },
      { ...base, id: "new", status: "upcoming", dueDate: new Date("2026-11-24T21:00:00.000Z") },
    ]
    expect(plan(rows, AFTER_TR_MIDNIGHT)).toEqual({ overdue: ["legacy", "new"] })
  })

  test("TR 25.11 23:30'da 25.11 kaydı hâlâ gecikmiş değildir", () => {
    const rows = [
      { ...base, id: "legacy", status: "upcoming", dueDate: new Date("2026-11-25T00:00:00.000Z") },
      { ...base, id: "new", status: "upcoming", dueDate: new Date("2026-11-24T21:00:00.000Z") },
    ]
    expect(plan(rows, BEFORE_TR_MIDNIGHT)).toEqual({})
  })

  test("yaklaşan kayıt hatırlatma penceresine girince due_soon olur", () => {
    const rows = [{ ...base, id: "a", status: "upcoming", dueDate: new Date("2026-11-28T21:00:00.000Z"), reminderDaysBefore: 7 }]
    expect(plan(rows, BEFORE_TR_MIDNIGHT)).toEqual({ due_soon: ["a"] })
  })

  test("tamamlanan/ertelenen/iptal kayıtlar etkilenmez ve değişmeyen kayıt atlanır", () => {
    const due = new Date("2026-11-01T00:00:00.000Z")
    const rows = [
      { ...base, id: "c", status: "completed", dueDate: due },
      { ...base, id: "p", status: "postponed", dueDate: due },
      { ...base, id: "x", status: "cancelled", dueDate: due },
      { ...base, id: "o", status: "overdue", dueDate: due },
    ]
    expect(plan(rows, AFTER_TR_MIDNIGHT)).toEqual({})
  })

  test("km eşiği geçen kayıt gecikir; ikinci koşu (idempotent) değişiklik üretmez", () => {
    const rows = [{ ...base, id: "k", status: "upcoming", dueDate: null, dueMileage: 10000, currentMileage: 10500 }]
    expect(plan(rows, AFTER_TR_MIDNIGHT)).toEqual({ overdue: ["k"] })
    expect(plan([{ ...rows[0], status: "overdue" }], AFTER_TR_MIDNIGHT)).toEqual({})
  })
})
