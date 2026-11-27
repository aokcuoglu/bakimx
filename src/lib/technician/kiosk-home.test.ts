import { describe, expect, test } from "bun:test"
import { groupKioskOrders } from "@/lib/technician/kiosk-home"
import type { TechnicianOrderRow } from "@/lib/technician/queries"

let seq = 0
function row(overrides: Partial<TechnicianOrderRow>): TechnicianOrderRow {
  seq += 1
  return {
    id: `o${seq}`,
    workOrderNo: `BX-${seq}`,
    status: "approved",
    customerName: "Müşteri",
    customerPhone: "5550000000",
    plate: "34ABC123",
    brand: "Fiat",
    model: "Egea",
    customerComplaint: "Fren sesi",
    estimatedDeliveryAt: null,
    assignedAt: null,
    completedAt: null,
    createdAt: new Date(2026, 10, 1, 0, seq).toISOString(),
    assignedTechnicianId: null,
    technicianName: null,
    checklistProgress: { completed: 0, total: 0 },
    hasActiveLabor: false,
    ...overrides,
  }
}

describe("groupKioskOrders", () => {
  test("taslak iş İşlerim'e girmez, Taslak'ta bir kez görünür", () => {
    const d = row({ id: "d", status: "draft", assignedTechnicianId: "t1" })
    const groups = groupKioskOrders([d], [d], "t1")
    expect(groups.mine).toEqual([])
    expect(groups.drafts.map((o) => o.id)).toEqual(["d"])
    expect(groups.others).toEqual([])
  })

  test("bana atanan iş diğer işlerde tekrar görünmez", () => {
    const a = row({ id: "a", assignedTechnicianId: "t1" })
    const b = row({ id: "b", assignedTechnicianId: "t2" })
    const groups = groupKioskOrders([a], [a, b], "t1")
    expect(groups.mine.map((o) => o.id)).toEqual(["a"])
    expect(groups.others.map((o) => o.id)).toEqual(["b"])
  })

  test("serviste olan önce gelir, aktif işçilik en üstte", () => {
    const waiting = row({ id: "w", status: "waiting_parts" })
    const active = row({ id: "p", status: "in_progress" })
    const labor = row({ id: "l", status: "in_progress", hasActiveLabor: true })
    const groups = groupKioskOrders([waiting, active, labor], [], "t1")
    expect(groups.mine.map((o) => o.id)).toEqual(["l", "p", "w"])
  })

  test("odak yoksa İşlerim boş, atölye işleri görünür", () => {
    const a = row({})
    const b = row({})
    const groups = groupKioskOrders([], [a, b], null)
    expect(groups.mine).toEqual([])
    expect(groups.others).toHaveLength(2)
  })
})
