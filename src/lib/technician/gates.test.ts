import { test, expect } from "bun:test"
import {
  countIncompleteItems,
  completeWorkBlockMessage,
  summarizeChecklist,
} from "./gates"

const item = (category: string, isCompleted: boolean) => ({ category, isCompleted })

test("tamamlanmamış kalem sayısı completedAt'e bakar", () => {
  expect(countIncompleteItems([{ completedAt: null }, { completedAt: new Date() }, { completedAt: "2026-07-27T00:00:00.000Z" }])).toBe(1)
})

test("kalem yoksa engel yok", () => {
  expect(countIncompleteItems([])).toBe(0)
})

test("özet tamamlanan ve kalan maddeyi sayar", () => {
  const items = [
    item("inspection", true),
    item("repair", false),
    item("repair", false),
    item("delivery", true),
  ]
  expect(summarizeChecklist(items)).toEqual({ total: 4, completed: 2, remaining: 2 })
})

test("madde yoksa özet sıfırdır", () => {
  expect(summarizeChecklist([])).toEqual({ total: 0, completed: 0, remaining: 0 })
})

/** Bu iş emrinden çıkarılan madde özette görünmez. */
test("silinen madde özetin dışında kalır", () => {
  const items = [
    item("inspection", true),
    item("repair", false),
    { ...item("delivery", false), deletedAt: "2026-08-10T00:00:00.000Z" },
  ]
  expect(summarizeChecklist(items)).toEqual({ total: 2, completed: 1, remaining: 1 })
})

/**
 * Kontrol listesi kapı DEĞİL (BAK-24): tamamlama mesajı yalnız iş kalemlerine
 * bakar, eksik kontrol maddesi iş emrini kapattırmamalı.
 */
test("tamamlama yalnız iş kalemlerine takılır", () => {
  expect(completeWorkBlockMessage(1)).toBe("İş tamamlanamaz: 1 iş kalemi \"yapıldı\" olarak işaretlenmedi")
  expect(completeWorkBlockMessage(0)).toBeNull()
})
