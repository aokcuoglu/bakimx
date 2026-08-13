import { z } from "zod/v4"
import { isEmailIdentifier } from "@/lib/user-identity"

/**
 * Giriş formu tek kimlik alanı taşır (BAK-40): değer `@` içeriyorsa e-posta
 * olarak doğrulanır — mevcut kullanıcılar için davranış birebir aynı. İçermiyorsa
 * kullanıcı adı yoludur ve iş yeri kodu ZORUNLUDUR: kullanıcı adları yalnız
 * tenant içinde benzersiz olduğu için kod olmadan hangi hesap olduğu çözülemez.
 */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, "E-posta adresi veya kullanıcı adı zorunludur"),
    workshopCode: z.string().trim().optional(),
    password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  })
  .refine((d) => !isEmailIdentifier(d.identifier) || z.email().safeParse(d.identifier).success, {
    message: "Geçerli bir e-posta adresi giriniz",
    path: ["identifier"],
  })
  .refine((d) => isEmailIdentifier(d.identifier) || Boolean(d.workshopCode), {
    message: "Kullanıcı adıyla giriş için iş yeri kodu gereklidir",
    path: ["workshopCode"],
  })

export const registerSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  workshopName: z.string().min(2, "İş yeri adı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  kvkkConsent: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === true || v === "on" || v === "true", {
      message: "Devam etmek için aydınlatma metnini onaylamanız gerekir",
    }),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Geçersiz sıfırlama bağlantısı"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })