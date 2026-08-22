import { expect, test } from "bun:test"
import { aiPartSearchAllowedRole, normalizeAiSearchQuery } from "./ai-search"

test("AI parça araması yalnız yönetici ve ustaya açıktır", () => {
  expect(aiPartSearchAllowedRole("owner")).toBe(true)
  expect(aiPartSearchAllowedRole("usta")).toBe(true)
  expect(aiPartSearchAllowedRole("manager")).toBe(false)
  expect(aiPartSearchAllowedRole("cirak")).toBe(false)
})

test("model sorgusu güvenli uzunluğa ve tek boşluğa indirgenir", () => {
  expect(normalizeAiSearchQuery("  ön   fren balatası ", "x")).toBe("ön fren balatası")
  expect(normalizeAiSearchQuery(null, " yağ filtresi ")).toBe("yağ filtresi")
  expect(normalizeAiSearchQuery("x".repeat(200), "y")).toHaveLength(120)
})
