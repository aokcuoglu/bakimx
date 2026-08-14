import { test, expect } from "bun:test"
import {
  countRemainingChecklist,
  countIncompleteItems,
  startChecklistReminder,
  completeChecklistReminder,
  completeWorkBlockMessage,
  summarizeChecklist,
  START_REMINDER_CATEGORIES,
  COMPLETE_REMINDER_CATEGORIES,
} from "./gates"

const item = (category: string, isCompleted: boolean) => ({ category, isCompleted })

test("hatırlatma o aşamadaki işaretlenmemiş maddeleri sayar", () => {
  const items = [item("inspection", false), item("inspection", false), item("inspection", true)]
  expect(countRemainingChecklist(items, START_REMINDER_CATEGORIES)).toBe(2)
})

test("başlama hatırlatması yalnız kontrol kategorisine bakar", () => {
  const items = [item("inspection", true), item("repair", false), item("delivery", false)]
  expect(countRemainingChecklist(items, START_REMINDER_CATEGORIES)).toBe(0)
})

test("tamamlama hatırlatması onarım + teslim kategorilerine bakar", () => {
  const items = [item("inspection", false), item("repair", false), item("delivery", false)]
  expect(countRemainingChecklist(items, COMPLETE_REMINDER_CATEGORIES)).toBe(2)
})

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

/**
 * Bu iş emrinden çıkarılan madde ne hatırlatmada ne özette görünür: kullanıcı
 * o kontrolü bilinçli olarak istemedi. Satır DB'de durduğu için eleme hem
 * sorguda hem burada yapılır — okuma yolunun biri filtreyi atlarsa sayı yine
 * de doğru çıksın.
 */
test("silinen madde hatırlatmada sayılmaz", () => {
  const items = [
    item("inspection", false),
    { ...item("inspection", false), deletedAt: new Date() },
  ]
  expect(countRemainingChecklist(items, START_REMINDER_CATEGORIES)).toBe(1)
})

test("silinen madde özetin dışında kalır", () => {
  const items = [
    item("inspection", true),
    item("repair", false),
    { ...item("delivery", false), deletedAt: "2026-08-10T00:00:00.000Z" },
  ]
  expect(summarizeChecklist(items)).toEqual({ total: 2, completed: 1, remaining: 1 })
})

test("eksik yoksa hatırlatma null", () => {
  expect(startChecklistReminder(0)).toBeNull()
  expect(completeChecklistReminder(0)).toBeNull()
})

test("eksik varsa hatırlatma sayıyı içerir", () => {
  expect(startChecklistReminder(3)).toBe("Araç kabul kontrollerinden 3 madde işaretlenmedi")
  expect(completeChecklistReminder(2)).toBe("Kontrol listesinde 2 madde işaretlenmedi")
})

/**
 * Kontrol listesi kapı DEĞİL (BAK-24): tamamlama mesajı yalnız iş kalemlerine
 * bakar, eksik kontrol maddesi iş emrini kapattırmamalı.
 */
test("tamamlama yalnız iş kalemlerine takılır", () => {
  expect(completeWorkBlockMessage(1)).toBe("İş tamamlanamaz: 1 iş kalemi \"yapıldı\" olarak işaretlenmedi")
  expect(completeWorkBlockMessage(0)).toBeNull()
})
