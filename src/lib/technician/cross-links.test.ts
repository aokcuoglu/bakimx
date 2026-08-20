import { test, expect } from "bun:test"
import { workOrderPath, technicianOrderPath, canOpenTechnicianView } from "./cross-links"

test("iş emri linki id ile kurulur", () => {
  expect(workOrderPath("abc123")).toBe("/orders/abc123")
})

test("teknisyen görünümü linki id ile kurulur", () => {
  expect(technicianOrderPath("abc123")).toBe("/technician/orders/abc123")
})

test("teknisyen atanmamış iş emrinde de teknisyen görünümü açılır", () => {
  expect(canOpenTechnicianView(null)).toBe(true)
  expect(canOpenTechnicianView(undefined)).toBe(true)
  expect(canOpenTechnicianView("")).toBe(true)
})

test("teknisyen atanmışsa ters link gösterilir", () => {
  expect(canOpenTechnicianView("tech-1")).toBe(true)
})
