import { z } from "zod"

export const quoteItemSchema = z.object({
  type: z.enum(["part", "labor"], { error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)" }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır"),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz").nullable(),
  totalPrice: z.coerce.number().min(0, "Toplam fiyat negatif olamaz").nullable(),
  note: z.string().optional().default(""),
})

export type QuoteItemFormValues = z.infer<typeof quoteItemSchema>

export const quoteSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().default(""),
  title: z.string().optional().default(""),
  customerRequest: z.string().optional().default(""),
  internalNote: z.string().optional().default(""),
  validUntil: z.string().optional().default(""),
  status: z.enum(["draft", "sent"]).default("draft"),
  discountAmount: z.string().optional().default("0"),
  taxRate: z.string().optional().default("20"),
  items: z.array(quoteItemSchema).default([]),
})

export type QuoteFormValues = z.infer<typeof quoteSchema>