import { z } from "zod"

export const salesAdvisorInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin"),
  firstName: z.string().trim().min(1, "Ad zorunludur").max(60),
  lastName: z.string().trim().min(1, "Soyad zorunludur").max(60),
})

export const salesAdvisorAcceptSchema = z.object({
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır").max(128),
  confirmPassword: z.string().min(1, "Şifre tekrarı zorunludur"),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
})

export type SalesAdvisorInviteValues = z.infer<typeof salesAdvisorInviteSchema>
export type SalesAdvisorAcceptValues = z.infer<typeof salesAdvisorAcceptSchema>
