import { test, expect } from "bun:test"
import {
  countBlockingChecklist,
  countIncompleteItems,
  startWorkBlockMessage,
  completeWorkBlockMessage,
  summarizeChecklist,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
} from "./gates"

const req = (category: string, isCompleted: boolean) => ({ category, isCompleted, isRequired: true })

test("yalnız zorunlu maddeler bloklar", () => {
  const items = [
    req("inspection", false),
    { category: "inspection", isCompleted: false, isRequired: false },
  ]
  expect(countBlockingChecklist(items, START_GATE_CATEGORIES)).toBe(1)
})

test("başlama kapısı yalnız kontrol kategorisine bakar", () => {
  const items = [req("inspection", true), req("repair", false), req("delivery", false)]
  expect(countBlockingChecklist(items, START_GATE_CATEGORIES)).toBe(0)
})

test("tamamlama kapısı onarım + teslim kategorilerine bakar", () => {
  const items = [req("inspection", false), req("repair", false), req("delivery", false)]
  expect(countBlockingChecklist(items, COMPLETE_GATE_CATEGORIES)).toBe(2)
})

test("tamamlanmamış kalem sayısı completedAt'e bakar", () => {
  expect(countIncompleteItems([{ completedAt: null }, { completedAt: new Date() }, { completedAt: "2026-07-27T00:00:00.000Z" }])).toBe(1)
})

test("kalem yoksa engel yok", () => {
  expect(countIncompleteItems([])).toBe(0)
})

test("özet tamamlanan ve kalan zorunlu maddeyi sayar", () => {
  const items = [
    req("inspection", true),
    req("repair", false),
    { category: "repair", isCompleted: false, isRequired: false },
    { category: "delivery", isCompleted: true, isRequired: false },
  ]
  expect(summarizeChecklist(items)).toEqual({ total: 4, completed: 2, missingRequired: 1 })
})

test("madde yoksa özet sıfırdır", () => {
  expect(summarizeChecklist([])).toEqual({ total: 0, completed: 0, missingRequired: 0 })
})

/**
 * Bu iş emrinden çıkarılan madde ne kapıyı kilitler ne de özette görünür:
 * kullanıcı o kontrolü bilinçli olarak istemedi. Satır DB'de durduğu için
 * eleme hem sorguda hem burada yapılır — okuma yolunun biri filtreyi atlarsa
 * kapı yine de doğru cevabı versin.
 */
test("silinen zorunlu madde kapıyı bloklamaz", () => {
  const items = [
    req("inspection", false),
    { ...req("inspection", false), deletedAt: new Date() },
  ]
  expect(countBlockingChecklist(items, START_GATE_CATEGORIES)).toBe(1)
})

test("silinen madde özetin dışında kalır", () => {
  const items = [
    req("inspection", true),
    req("repair", false),
    { ...req("delivery", false), deletedAt: "2026-08-10T00:00:00.000Z" },
  ]
  expect(summarizeChecklist(items)).toEqual({ total: 2, completed: 1, missingRequired: 1 })
})

test("eksik yoksa başlama mesajı null", () => {
  expect(startWorkBlockMessage(0)).toBeNull()
})

test("eksik varsa başlama mesajı sayıyı içerir", () => {
  expect(startWorkBlockMessage(3)).toBe("Araç kabul kontrolleri tamamlanmadan tamire başlanamaz (3 madde eksik)")
})

test("tamamlama mesajı iki eksiği birlikte anlatır", () => {
  expect(completeWorkBlockMessage(2, 3)).toBe("İş tamamlanamaz: 2 kontrol maddesi ve 3 iş kalemi eksik")
})

test("tamamlama mesajı yalnız kontrol eksiğinde", () => {
  expect(completeWorkBlockMessage(2, 0)).toBe("İş tamamlanamaz: 2 kontrol maddesi eksik")
})

test("tamamlama mesajı yalnız kalem eksiğinde", () => {
  expect(completeWorkBlockMessage(0, 1)).toBe("İş tamamlanamaz: 1 iş kalemi \"yapıldı\" olarak işaretlenmedi")
})

test("hiç eksik yoksa tamamlama mesajı null", () => {
  expect(completeWorkBlockMessage(0, 0)).toBeNull()
})
