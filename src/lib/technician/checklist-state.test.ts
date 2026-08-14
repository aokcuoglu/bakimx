import { test, expect } from "bun:test"
import {
  activeChecklist,
  applyChecklistPatch,
  checklistProgress,
  incompleteChecklistIds,
  removedChecklist,
} from "./checklist-state"

const NOW = "2026-08-11T10:00:00.000Z"

const row = (
  id: string,
  category: string,
  isCompleted = false,
  deletedAt: string | null = null
) => ({
  id,
  category,
  isCompleted,
  completedAt: isCompleted ? "2026-08-01T00:00:00.000Z" : null,
  deletedAt,
})

test("toggle yalnız hedeflenen maddeyi işaretler", () => {
  const items = [row("a", "inspection"), row("b", "inspection")]
  const next = applyChecklistPatch(items, { type: "toggle", ids: ["a"], done: true }, NOW)

  expect(next[0]).toEqual({ ...items[0], isCompleted: true, completedAt: NOW })
  expect(next[1]).toBe(items[1])
})

test("toggle geri alındığında tamamlanma zamanı silinir", () => {
  const items = [row("a", "repair", true)]
  const next = applyChecklistPatch(items, { type: "toggle", ids: ["a"], done: false }, NOW)

  expect(next[0].isCompleted).toBe(false)
  expect(next[0].completedAt).toBeNull()
})

test("toplu toggle birden çok maddeye aynı anda dokunur", () => {
  const items = [row("a", "repair"), row("b", "repair", true), row("c", "delivery")]
  const next = applyChecklistPatch(items, { type: "toggle", ids: ["a", "b"], done: true }, NOW)

  expect(next.map((i) => i.isCompleted)).toEqual([true, true, false])
  // Zaten işaretli olanın zamanı da ezilir; çağıran yalnız eksikleri gönderir
  // (`incompleteChecklistIds`), sunucudaki filtre de öyle.
  expect(next[2]).toBe(items[2])
})

test("girdi mutasyona uğramaz", () => {
  const items = [row("a", "inspection")]
  applyChecklistPatch(items, { type: "toggle", ids: ["a"], done: true }, NOW)
  expect(items[0].isCompleted).toBe(false)
})

test("silme mezar taşı bırakır, geri alma kaldırır", () => {
  const items = [row("a", "inspection")]
  const deleted = applyChecklistPatch(items, { type: "delete", ids: ["a"] }, NOW)
  expect(deleted[0].deletedAt).toBe(NOW)

  const restored = applyChecklistPatch(deleted, { type: "restore", ids: ["a"] }, NOW)
  expect(restored[0].deletedAt).toBeNull()
})

test("zaten silinmiş maddenin silinme anı ezilmez", () => {
  const items = [row("a", "inspection", false, "2026-08-01T00:00:00.000Z")]
  const next = applyChecklistPatch(items, { type: "delete", ids: ["a"] }, NOW)
  expect(next[0].deletedAt).toBe("2026-08-01T00:00:00.000Z")
})

test("aktif ve silinmiş maddeler ayrışır", () => {
  const items = [row("a", "inspection"), row("b", "repair", false, NOW)]
  expect(activeChecklist(items).map((i) => i.id)).toEqual(["a"])
  expect(removedChecklist(items).map((i) => i.id)).toEqual(["b"])
})

test("ilerleme silinenleri saymaz", () => {
  const items = [
    row("a", "inspection", true),
    row("b", "inspection"),
    row("c", "repair", true),
    row("d", "delivery", false, NOW),
  ]
  expect(checklistProgress(items)).toEqual({ total: 3, completed: 2, remaining: 1, percent: 67 })
})

test("madde yoksa ilerleme yüzdesi 0", () => {
  expect(checklistProgress([])).toEqual({ total: 0, completed: 0, remaining: 0, percent: 0 })
})

test("toplu işaretleme hedefi yalnız o aşamanın eksikleri", () => {
  const items = [
    row("a", "inspection"),
    row("b", "inspection", true),
    row("c", "repair"),
    row("d", "inspection", false, NOW),
  ]
  expect(incompleteChecklistIds(items, "inspection")).toEqual(["a"])
  expect(incompleteChecklistIds(items)).toEqual(["a", "c"])
})
