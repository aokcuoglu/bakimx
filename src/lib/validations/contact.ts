import { z } from "zod"

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,15}$/, "Geçerli bir telefon numarası girin"),
  title: z.string().trim().min(2, "Ünvan en az 2 karakter olmalıdır"),
  businessName: z.string().trim().min(2, "Şirket adı en az 2 karakter olmalıdır"),
  referral: z.string().trim().min(2, "Bu alanı doldurun"),
  message: z.string().trim().min(10, "Mesaj en az 10 karakter olmalıdır"),
})
