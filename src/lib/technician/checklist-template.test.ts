import { test, expect } from "bun:test"
import { CHECKLIST_TEMPLATE, missingTemplateItems, templateSortOrder } from "./checklist-template"

test("şablon üç kategoriyi de kapsar", () => {
  const cats = new Set(CHECKLIST_TEMPLATE.map((t) => t.category))
  expect(cats).toEqual(new Set(["inspection", "repair", "delivery"]))
})

test("şablon anahtarları benzersizdir", () => {
  const keys = CHECKLIST_TEMPLATE.map((t) => t.key)
  expect(new Set(keys).size).toBe(keys.length)
})

test("boş iş emrinde tüm maddeler eksik sayılır", () => {
  expect(missingTemplateItems([])).toHaveLength(CHECKLIST_TEMPLATE.length)
})

test("var olan anahtarlar tekrar üretilmez (idempotent seed)", () => {
  const half = CHECKLIST_TEMPLATE.slice(0, 3).map((t) => t.key)
  const missing = missingTemplateItems(half)
  expect(missing).toHaveLength(CHECKLIST_TEMPLATE.length - 3)
  expect(missing.some((m) => half.includes(m.key))).toBe(false)
})

test("bilinmeyen anahtarlar eksik hesabını bozmaz", () => {
  expect(missingTemplateItems(["serbest.madde"])).toHaveLength(CHECKLIST_TEMPLATE.length)
})

test("sortOrder şablon sırasını korur", () => {
  expect(templateSortOrder(CHECKLIST_TEMPLATE[0].key)).toBe(0)
  expect(templateSortOrder(CHECKLIST_TEMPLATE[2].key)).toBe(2)
  expect(templateSortOrder("yok")).toBe(0)
})

test("kategoriler şablonda bloklar hâlinde sıralıdır", () => {
  const order = CHECKLIST_TEMPLATE.map((t) => t.category)
  const firstDelivery = order.indexOf("delivery")
  const lastInspection = order.lastIndexOf("inspection")
  expect(lastInspection).toBeLessThan(firstDelivery)
})
