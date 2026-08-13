import { expect, test } from "bun:test"
import {
  TEMP_PASSWORD_LENGTH,
  TEMP_PASSWORD_PATTERN,
  generateTempPassword,
} from "./temp-password"

test("geçici şifre beklenen biçimde üretilir", () => {
  for (let i = 0; i < 50; i++) {
    const password = generateTempPassword()
    expect(password).toMatch(TEMP_PASSWORD_PATTERN)
    expect(password.length).toBe(TEMP_PASSWORD_LENGTH)
  }
})

test("geçici şifre şifre alt sınırını (8 karakter) aşar", () => {
  // `changePasswordSchema` / `resetPasswordSchema` 8 karakter istiyor; geçici
  // şifre kullanıcı şifresi olarak kaydedildiği için o kapıya takılmamalı.
  expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8)
  expect(generateTempPassword().length).toBeGreaterThanOrEqual(8)
})

test("karışan karakterler (I, O, 0, 1) hiç geçmez", () => {
  // Şifre kâğıda basılıp elle giriliyor: okunamayan bir karakter sahibi yeniden
  // sıfırlamaya zorlar.
  const sample = Array.from({ length: 400 }, () => generateTempPassword()).join("")
  for (const ambiguous of ["I", "O", "0", "1"]) {
    expect(sample).not.toContain(ambiguous)
  }
})

test("küçük harf ve tire dışında ayraç içermez", () => {
  const password = generateTempPassword()
  expect(password).toBe(password.toUpperCase())
  expect(password.split("-")).toHaveLength(2)
})

test("üretilen şifreler tekrarlanmaz (rastgelelik gerçek)", () => {
  const generated = new Set(Array.from({ length: 500 }, () => generateTempPassword()))
  // 32^8 uzayda 500 çekimde çakışma pratikte imkânsız; sabit/tahmin edilebilir
  // bir üretici bu testi anında düşürür.
  expect(generated.size).toBe(500)
})
