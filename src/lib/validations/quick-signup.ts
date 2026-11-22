import { z } from "zod"
import { normalizePhone } from "@/lib/format"

/**
 * Ana sayfadaki "Ücretsiz deneyin" penceresi (#783). Alanlar ve hata metinleri
 * e-santral.com/bakimx app.js ile aynı; sunucu `registerSchema`'yı
 * `signupFlow: "quick"` ile uygular (il/adres sonradan).
 */
export const quickSignupSchema = z.object({
  workshopName: z.string().trim().min(1, "Dükkân adını yazın."),
  fullName: z
    .string()
    .trim()
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Adınızı ve soyadınızı yazın."),
  phone: z
    .string()
    .refine((value) => /^5\d{9}$/.test(normalizePhone(value)), "Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın."),
  email: z
    .string()
    .trim()
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), "Geçerli bir e-posta adresi yazın."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı."),
  consent: z.boolean().refine((value) => value, "Devam etmek için onay kutusunu işaretleyin."),
})

export type QuickSignup = z.infer<typeof quickSignupSchema>

/** "Ayşe Nur Yılmaz" → ad "Ayşe Nur", soyad "Yılmaz" (sunucu ad ve soyadı ayrı ister). */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const lastName = parts.pop() ?? ""
  return { firstName: parts.join(" "), lastName }
}
