import { test, expect } from "bun:test"
import { shouldSeedChecklist } from "./checklist-seed"
import { CHECKLIST_TEMPLATE, missingTemplateItems, templateSortOrder } from "./checklist-template"
import {
  countBlockingChecklist,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
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
 * Asıl regresyon: boş kontrol listesi "0 engel" ürettiği için kapılar sessizce
 * açılıyordu. Seed sonrası her iki kapının da engellemesi şart — aksi hâlde
 * şablondan bir kategorinin tüm maddeleri silinse kapı yine sessizce açılır.
 */
test("boş liste kapıları açar — bu yüzden seed kapıdan önce çalışmalı", () => {
  expect(countBlockingChecklist([], START_GATE_CATEGORIES)).toBe(0)
  expect(countBlockingChecklist([], COMPLETE_GATE_CATEGORIES)).toBe(0)
})

test("seed edilmiş liste her iki kapıyı da bloklar", () => {
  const seeded = CHECKLIST_TEMPLATE.map((t) => ({
    category: t.category,
    isCompleted: false,
    isRequired: true,
    sortOrder: templateSortOrder(t.key),
  }))
  expect(countBlockingChecklist(seeded, START_GATE_CATEGORIES)).toBeGreaterThan(0)
  expect(countBlockingChecklist(seeded, COMPLETE_GATE_CATEGORIES)).toBeGreaterThan(0)
})
