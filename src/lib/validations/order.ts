import { z } from "zod/v4"

export const serviceOrderItemSchema = z.object({
  type: z.enum(["part", "labor"], {
    error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)",
  }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  // Money is integer kuruş (client converts TRY -> kuruş before submit).
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().int("Toplam fiyat kuruş (tam sayı) olmalıdır").min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
})