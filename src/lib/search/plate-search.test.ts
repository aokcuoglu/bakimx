import { expect, test } from "bun:test"
import { plateSearchTerm } from "@/lib/search/plate-search"

test("plateSearchTerm: ayraçları atar, büyütür", () => {
  expect(plateSearchTerm("34 abc 123")).toBe("34ABC123")
  expect(plateSearchTerm("34-ABC-123")).toBe("34ABC123")
})

test("plateSearchTerm: zaten bitişik plaka aynen döner", () => {
  expect(plateSearchTerm("34ABC123")).toBe("34ABC123")
})

test("plateSearchTerm: kısmi giriş de sadeleşir", () => {
  expect(plateSearchTerm("34 ab")).toBe("34AB")
})

test("plateSearchTerm: üç karakterden kısa terim aramaya girmez", () => {
  expect(plateSearchTerm("34")).toBe("")
  expect(plateSearchTerm("3 4")).toBe("")
  expect(plateSearchTerm("  ")).toBe("")
})

test("plateSearchTerm: Türkçe harfler korunur", () => {
  expect(plateSearchTerm("06 ğüş 12")).toBe("06ĞÜŞ12")
})
