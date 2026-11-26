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

test("açık iş yoksa engel de not da yok", () => {
  expect(step("in_progress")).toEqual({ label: "Teslime Hazır", blocker: null, note: null })
})

// Başlıktaki kural: karar bekleyen talep "Teslime Hazır"ı ve teslimi kapatır.
test("karar bekleyen parça talebi yalnız Teslime Hazır ve teslim adımında engeldir", () => {
  expect(step("in_progress", 0, 2)).toEqual({ label: "Teslime Hazır", blocker: "2 parça talebi karar bekliyor", note: null })
  expect(step("ready_for_delivery", 3, 1)?.blocker).toBe("1 parça talebi karar bekliyor")
})

test("sıradaki adımı kapatmıyorsa karar bekleyen talep nötr not olur", () => {
  expect(step("draft", 0, 2)).toEqual({ label: "Başla", blocker: null, note: "2 parça talebi karar bekliyor" })
  expect(step("waiting_parts", 0, 1)).toEqual({ label: "Devam Et", blocker: null, note: "1 parça talebi karar bekliyor" })
})

test("fiyatsız kalem yalnız teslim adımında engeldir, önceki adımlarda yazılmaz", () => {
  expect(step("in_progress", 3)).toEqual({ label: "Teslime Hazır", blocker: null, note: null })
  expect(step("draft", 3)).toEqual({ label: "Başla", blocker: null, note: null })
  expect(step("ready_for_delivery", 3)).toEqual({ label: "Teslim Et", blocker: "3 kalemin fiyatı girilmemiş", note: null })
})

test("birincil aksiyonu olmayan liste adım üretmez", () => {
  expect(orderNextStep({ status: "in_progress", actions: [], unpricedCount: 0, undecidedCount: 0 })).toBeNull()
})
