import { expect, test } from "bun:test"
import { ORDER_STATUS } from "@/lib/constants"
import { orderStatusPillTone } from "./status-pill"

test("iş emri durumu → hap tonu", () => {
  expect(orderStatusPillTone("draft")).toBe("neutral")
  expect(orderStatusPillTone("in_progress")).toBe("info")
  expect(orderStatusPillTone("waiting_parts")).toBe("warning")
  expect(orderStatusPillTone("ready_for_delivery")).toBe("success")
  expect(orderStatusPillTone("cancelled")).toBe("destructive")
})

test("bilinmeyen durum nötr; ORDER_STATUS'taki her anahtarın tonu var", () => {
  expect(orderStatusPillTone("whatever")).toBe("neutral")
  expect(orderStatusPillTone("constructor")).toBe("neutral")
  for (const key of Object.keys(ORDER_STATUS)) {
    expect(["info", "warning", "success", "destructive", "neutral"]).toContain(orderStatusPillTone(key))
  }
})
