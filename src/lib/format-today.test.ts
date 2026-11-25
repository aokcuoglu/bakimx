import { describe, expect, test } from "bun:test"
import { formatTodayTr } from "./format-today"

describe("formatTodayTr", () => {
  test("UTC gece yarısı öncesi Türkiye'de ertesi gündür", () => {
    const out = formatTodayTr(new Date("2026-11-24T22:30:00Z"))
    expect(out).toContain("25")
    expect(out).toContain("Çarşamba")
  })
  test("Türkiye gün içinde aynı gün", () => {
    const out = formatTodayTr(new Date("2026-11-25T09:00:00Z"))
    expect(out).toContain("25")
  })
})
