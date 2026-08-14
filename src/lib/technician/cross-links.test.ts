import { test, expect } from "bun:test"
import { workOrderPath, technicianOrderPath, canOpenTechnicianView } from "./cross-links"

test("iş emri linki id ile kurulur", () => {
  expect(workOrderPath("abc123")).toBe("/orders/abc123")
})

test("teknisyen görünümü linki id ile kurulur", () => {
  expect(technicianOrderPath("abc123")).toBe("/technician/orders/abc123")
})

test("teknisyen atanmamış iş emrinde ters link gösterilmez", () => {
  // Rota `assignedTechnicianId: { not: null }` arıyor; atama yokken link 404'e götürür.
  expect(canOpenTechnicianView(null)).toBe(false)
  expect(canOpenTechnicianView(undefined)).toBe(false)
  expect(canOpenTechnicianView("")).toBe(false)
})

test("teknisyen atanmışsa ters link gösterilir", () => {
  expect(canOpenTechnicianView("tech-1")).toBe(true)
})
