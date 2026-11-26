import { expect, test } from "bun:test"
import { NEXT_STATUSES } from "@/components/orders/order-management-panel"
import { orderNextStep } from "@/lib/orders/next-step"

const step = (status: string, unpricedCount = 0, undecidedCount = 0) =>
  orderNextStep({ status, actions: NEXT_STATUSES[status] ?? [], unpricedCount, undecidedCount })

test("sıradaki adım başlıktaki birincil aksiyonla aynıdır", () => {
  expect(step("draft")?.label).toBe("Başla")
  expect(step("waiting_approval")?.label).toBe("Başla")
  expect(step("approved")?.label).toBe("Başla")
  expect(step("in_progress")?.label).toBe("Teslime Hazır")
  expect(step("waiting_parts")?.label).toBe("Devam Et")
  expect(step("ready_for_delivery")?.label).toBe("Teslim Et")
})

test("teslim edilmiş ve iptal emirde sıradaki adım yok", () => {
  expect(step("delivered")).toBeNull()
  expect(step("cancelled")).toBeNull()
  expect(step("cancelled", 2, 1)).toBeNull()
})

test("engel yoksa null", () => {
  expect(step("in_progress")).toEqual({ label: "Teslime Hazır", blocker: null })
})

test("karar bekleyen parça talebi teslim adımından önce de engeldir", () => {
  expect(step("in_progress", 0, 2)?.blocker).toBe("2 parça talebi karar bekliyor")
  expect(step("ready_for_delivery", 3, 1)?.blocker).toBe("1 parça talebi karar bekliyor")
})

test("fiyatsız kalem yalnız teslim adımında engeldir", () => {
  expect(step("in_progress", 3)?.blocker).toBeNull()
  expect(step("ready_for_delivery", 3)?.blocker).toBe("3 kalemin fiyatı girilmemiş")
})

test("birincil aksiyonu olmayan liste adım üretmez", () => {
  expect(orderNextStep({ status: "in_progress", actions: [], unpricedCount: 0, undecidedCount: 0 })).toBeNull()
})
