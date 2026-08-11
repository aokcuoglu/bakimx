import { test, expect } from "bun:test"
import { shouldSeedChecklist } from "./checklist-seed"
import { CHECKLIST_TEMPLATE, missingTemplateItems, templateSortOrder } from "./checklist-template"
import {
  countRemainingChecklist,
  START_REMINDER_CATEGORIES,
  COMPLETE_REMINDER_CATEGORIES,
} from "./gates"

const assigned = { status: "in_progress" as const, assignedTechnicianId: "tech_1" }
const allKeys = CHECKLIST_TEMPLATE.map((t) => t.key)

test("atanmış ve boş iş emri seed edilir", () => {
  expect(shouldSeedChecklist(assigned, [])).toBe(true)
})

test("şablon tamsa tekrar seed edilmez", () => {
  expect(shouldSeedChecklist(assigned, allKeys)).toBe(false)
})

test("şablona yeni madde eklendiğinde eksik tamamlanır", () => {
  expect(shouldSeedChecklist(assigned, allKeys.slice(0, -1))).toBe(true)
})

test("serbest maddeler şablon eksiğini kapatmaz", () => {
  expect(shouldSeedChecklist(assigned, [null, "serbest.madde"])).toBe(true)
})

/**
 * Silme iş emrine özel: satır mezar taşı olarak kaldığı için anahtar hâlâ
 * "var" sayılır ve madde bu iş emrine geri gelmez. Çağıran, silinen maddelerin
 * anahtarlarını da geçirmek zorunda — aksi hâlde her okumada boşuna seed
 * denenir.
 */
test("silinen şablon maddesi aynı iş emrinde yeniden seed edilmez", () => {
  expect(shouldSeedChecklist(assigned, allKeys)).toBe(false)
})

test("şablon silmeden etkilenmez — yeni iş emri tüm maddeleri alır", () => {
  // Yeni iş emrinin elinde hiç anahtar yok; silinenler dahil şablonun tamamı eksik.
  expect(missingTemplateItems([]).map((t) => t.key)).toEqual(allKeys)
})

test("teknisyen atanmamışsa seed edilmez", () => {
  expect(shouldSeedChecklist({ ...assigned, assignedTechnicianId: null }, [])).toBe(false)
})

test("kilitli iş emirlerinde seed edilmez", () => {
  expect(shouldSeedChecklist({ ...assigned, status: "delivered" }, [])).toBe(false)
  expect(shouldSeedChecklist({ ...assigned, status: "cancelled" }, [])).toBe(false)
})

test("taslak/onay bekleyen atanmış iş emri de seed edilir", () => {
  expect(shouldSeedChecklist({ ...assigned, status: "draft" }, [])).toBe(true)
  expect(shouldSeedChecklist({ ...assigned, status: "waiting_parts" }, [])).toBe(true)
})

/**
 * Kontrol listesi artık kapı değil (BAK-24), ama seed hâlâ önemli: liste boş
 * kalırsa teknisyene hatırlatılacak madde de kalmaz, iş emri kontrolsüz kapanır.
 */
test("boş listede hatırlatılacak madde yoktur", () => {
  expect(countRemainingChecklist([], START_REMINDER_CATEGORIES)).toBe(0)
  expect(countRemainingChecklist([], COMPLETE_REMINDER_CATEGORIES)).toBe(0)
})

test("seed edilmiş liste her iki aşamada da hatırlatma üretir", () => {
  const seeded = CHECKLIST_TEMPLATE.map((t) => ({
    category: t.category,
    isCompleted: false,
    sortOrder: templateSortOrder(t.key),
  }))
  expect(countRemainingChecklist(seeded, START_REMINDER_CATEGORIES)).toBeGreaterThan(0)
  expect(countRemainingChecklist(seeded, COMPLETE_REMINDER_CATEGORIES)).toBeGreaterThan(0)
})
