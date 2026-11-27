import { describe, expect, test } from "bun:test"
import { reminderDateInputValue, reminderDaysUntil } from "./dates"

const NEW_SHAPE = new Date("2026-11-25T21:00:00.000Z") // İstanbul 26.11 00:00
const LEGACY_SHAPE = new Date("2026-11-26T00:00:00.000Z") // eski UTC gece yarısı

describe("reminderDateInputValue (#933)", () => {
  test("yeni ve eski kayıt biçimi aynı günü verir", () => {
    expect(reminderDateInputValue(NEW_SHAPE)).toBe("2026-11-26")
    expect(reminderDateInputValue(LEGACY_SHAPE)).toBe("2026-11-26")
  })
  test("boş değerde boş dize", () => {
    expect(reminderDateInputValue(null)).toBe("")
    expect(reminderDateInputValue(undefined)).toBe("")
  })
})

describe("reminderDaysUntil (#933)", () => {
  const now = new Date("2026-11-24T10:00:00.000Z")
  test("iki kayıt biçimi için aynı gün sayısı", () => {
    expect(reminderDaysUntil(NEW_SHAPE, now)).toBe(2)
    expect(reminderDaysUntil(LEGACY_SHAPE, now)).toBe(2)
  })
  test("bugün 0, dün -1", () => {
    expect(reminderDaysUntil(new Date("2026-11-23T21:00:00.000Z"), now)).toBe(0)
    expect(reminderDaysUntil(new Date("2026-11-23T00:00:00.000Z"), now)).toBe(-1)
  })
})
