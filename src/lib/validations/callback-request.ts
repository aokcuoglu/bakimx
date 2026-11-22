import { z } from "zod"
import { normalizePhone } from "@/lib/format"

/**
 * Ana sayfa "Sizi arayalım" penceresi (#781). Kurallar e-santral.com/bakimx
 * app.js'teki istemci doğrulamasıyla aynı: ad + soyad, Türk cep telefonu
 * (+90 / baştaki 0 toleranslı), açık rıza onayı.
 */
export const callbackRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Adınızı ve soyadınızı yazın."),
  phone: z
    .string()
    .refine((value) => /^5\d{9}$/.test(normalizePhone(value)), "Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın."),
  consent: z.boolean().refine((value) => value, "Devam etmek için onay kutusunu işaretleyin."),
})

export type CallbackRequest = z.infer<typeof callbackRequestSchema>
