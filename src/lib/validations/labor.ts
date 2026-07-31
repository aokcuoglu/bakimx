import { z } from "zod/v4"

export const laborItemSchema = z.object({
  code: z.string().trim().max(32, "İşçilik kodu en fazla 32 karakter olabilir").optional(),
  name: z.string().trim().min(1, "İşçilik adı zorunludur").max(120, "İşçilik adı en fazla 120 karakter olabilir"),
  category: z.string().trim().max(60, "Kategori en fazla 60 karakter olabilir").optional(),
  // kuruş — form TL alır, istemci liraToKurus ile çevirip gönderir.
  defaultPriceKurus: z
    .number()
    .int("Ücret kuruş (tam sayı) olmalıdır")
    .min(0, "Ücret negatif olamaz")
    .nullable()
    .optional(),
  description: z.string().trim().max(500, "Açıklama en fazla 500 karakter olabilir").optional(),
  isActive: z.boolean().default(true),
})

export type LaborItemInput = z.input<typeof laborItemSchema>
