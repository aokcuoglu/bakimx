import { z } from "zod/v4"
import { luhnCheck } from "./payment-helpers"

/**
 * Kart alanları için ortak SERVER-SIDE doğrulama şeması. Satış ödemesi akışı
 * (payments/initiate) bu şemayı kullanır — güvenlik bariyeri değişmez. Kart verisi
 * burada YALNIZ doğrulama için işlenir; hiçbir yere loglanmaz/saklanmaz (çağıran
 * route sanitizeForLog kullanır).
 */
export const cardSchema = z
  .object({
    holderName: z.string().trim().min(2).max(64),
    number: z
      .string()
      .transform((s) => s.replace(/\s/g, ""))
      .refine((s) => /^\d{12,19}$/.test(s), "Kart numarası geçersiz")
      .refine((s) => luhnCheck(s), "Kart numarası geçersiz"),
    expireMonth: z.coerce.number().int().min(1).max(12),
    expireYear: z.coerce.number().int(),
    cvv: z.string().refine((s) => /^\d{3,4}$/.test(s), "CVV geçersiz"),
  })
  .transform((c) => ({
    ...c,
    // 2 haneli yılı 4 haneye normalize et ("28" → 2028).
    expireYear: c.expireYear < 100 ? c.expireYear + 2000 : c.expireYear,
  }))
  .refine(
    (c) => {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      return c.expireYear > y || (c.expireYear === y && c.expireMonth >= m)
    },
    { message: "Kartın son kullanma tarihi geçmiş" }
  )

export type CardInput = z.infer<typeof cardSchema>
