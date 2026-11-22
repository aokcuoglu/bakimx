import { expect, test } from "bun:test"
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from "./auth"

test("forgotPasswordSchema rejects invalid email, accepts valid", () => {
  expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false)
  expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true)
})

test("resetPasswordSchema needs password >= 8 chars", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "short", confirmPassword: "short" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema needs matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "different1" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema accepts valid matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "longenough" })
  expect(r.success).toBe(true)
})

// #783 — ana sayfadaki "Ücretsiz deneyin" penceresi yalnız dükkân adı, ad soyad,
// cep telefonu, e-posta ve şifre sorar; il ve adres sonradan Ayarlar'da doldurulur.
const QUICK_SIGNUP = {
  signupFlow: "quick",
  workshopName: "Yıldız Oto",
  firstName: "Ali",
  lastName: "Veli",
  phone: "0532 123 45 67",
  email: "ali@example.com",
  password: "gizli-sifre-1",
  kvkkConsent: true,
}

test("registerSchema hızlı kayıtta il ve adres istemez", () => {
  const result = registerSchema.safeParse(QUICK_SIGNUP)
  expect(result.success).toBe(true)
  expect(result.data?.city).toBe("")
  expect(result.data?.address).toBe("")
})

test("registerSchema tam kayıtta (varsayılan) il ve adresi hâlâ zorunlu tutar", () => {
  const { signupFlow: _flow, ...full } = QUICK_SIGNUP
  const result = registerSchema.safeParse(full)
  expect(result.success).toBe(false)
  expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual(["address", "city"])
})

test("registerSchema bilinmeyen kayıt akışını reddeder", () => {
  expect(registerSchema.safeParse({ ...QUICK_SIGNUP, signupFlow: "baska", city: "İstanbul", address: "Merkez" }).success).toBe(false)
})
