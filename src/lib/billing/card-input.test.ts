import { expect, test } from "bun:test"
import {
  stripNonDigits,
  luhnValid,
  formatCardNumber,
  isExpiryPast,
} from "./card-input"

test("stripNonDigits: yalnız rakamları bırakır", () => {
  expect(stripNonDigits("4242 4242 4242 4242")).toBe("4242424242424242")
  expect(stripNonDigits("4242-4242-4242-4242")).toBe("4242424242424242")
  expect(stripNonDigits("abc12 34x")).toBe("1234")
  expect(stripNonDigits("")).toBe("")
  expect(stripNonDigits("   ")).toBe("")
})

test("luhnValid: geçerli/geçersiz kart numaraları", () => {
  expect(luhnValid("4111111111111111")).toBe(true)
  expect(luhnValid("4242 4242 4242 4242")).toBe(true) // boşluklu da kabul (temizler)
  expect(luhnValid("4111111111111112")).toBe(false) // son hane değişti
  expect(luhnValid("4242424242424241")).toBe(false)
  expect(luhnValid("1234")).toBe(false) // 12 haneden kısa
  expect(luhnValid("")).toBe(false)
  expect(luhnValid("12345678901234567890")).toBe(false) // 19 haneden uzun
})

test("formatCardNumber: 4'lü gruplama, yalnız rakam", () => {
  expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242")
  expect(formatCardNumber("4242 4242 42")).toBe("4242 4242 42")
  expect(formatCardNumber("424")).toBe("424")
  expect(formatCardNumber("abc4242def4242")).toBe("4242 4242")
  expect(formatCardNumber("")).toBe("")
  // 19 haneye kadar sınırlar (aşan rakamlar atılır)
  expect(formatCardNumber("42424242424242424242")).toBe("4242 4242 4242 4242 424")
})

test("isExpiryPast: geçmiş SKT tespiti (now enjekte edilir)", () => {
  const now = new Date(2026, 6, 15) // Temmuz 2026 (month index 6)
  expect(isExpiryPast(6, 2026, now)).toBe(true) // Haziran 2026 geçmiş
  expect(isExpiryPast(7, 2026, now)).toBe(false) // Temmuz 2026 = bu ay, geçerli
  expect(isExpiryPast(8, 2026, now)).toBe(false) // gelecek ay
  expect(isExpiryPast(1, 2027, now)).toBe(false) // gelecek yıl
  expect(isExpiryPast(12, 2025, now)).toBe(true) // geçen yıl
  // 2 haneli yıl 4 haneye normalize edilir
  expect(isExpiryPast(7, 26, now)).toBe(false)
  expect(isExpiryPast(6, 26, now)).toBe(true)
  // geçersiz ay → geçmiş sayılır (submit engellenir)
  expect(isExpiryPast(0, 2027, now)).toBe(true)
  expect(isExpiryPast(13, 2027, now)).toBe(true)
})
