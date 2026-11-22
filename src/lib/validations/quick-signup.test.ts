import { expect, test } from "bun:test"
import { quickSignupSchema, splitFullName } from "./quick-signup"

const valid = {
  workshopName: "Yıldız Oto",
  fullName: "Ali Veli",
  phone: "0532 123 45 67",
  email: "ali@example.com",
  password: "gizli-sifre",
  consent: true,
}

const firstMessage = (values: Record<string, unknown>) => quickSignupSchema.safeParse(values).error?.issues[0]?.message

test("geçerli pencere girdisi kabul edilir", () => {
  expect(quickSignupSchema.safeParse(valid).success).toBe(true)
})

test("kaynak sayfanın hata metinleri", () => {
  expect(firstMessage({ ...valid, workshopName: "  " })).toBe("Dükkân adını yazın.")
  expect(firstMessage({ ...valid, fullName: "Ali" })).toBe("Adınızı ve soyadınızı yazın.")
  expect(firstMessage({ ...valid, phone: "0212 123 45 67" })).toBe("Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın.")
  expect(firstMessage({ ...valid, email: "ali@" })).toBe("Geçerli bir e-posta adresi yazın.")
  expect(firstMessage({ ...valid, password: "1234567" })).toBe("Şifre en az 8 karakter olmalı.")
  expect(firstMessage({ ...valid, consent: false })).toBe("Devam etmek için onay kutusunu işaretleyin.")
})

test("ad soyad son kelimeden ayrılır", () => {
  expect(splitFullName("Ali Veli")).toEqual({ firstName: "Ali", lastName: "Veli" })
  expect(splitFullName("  Ayşe  Nur   Yılmaz ")).toEqual({ firstName: "Ayşe Nur", lastName: "Yılmaz" })
})
