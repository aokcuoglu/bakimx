import { z } from "zod/v4"

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

// Action-side item schema (kept separate from the form quoteItemSchema to
// preserve server-action parsing behaviour: quantity defaults to 1, prices
// optional, note optional without a default).
export const quoteItemActionSchema = z.object({
  type: z.enum(["part", "labor"], { error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)" }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
})

export const quoteCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().or(z.literal("")),
  title: z.string().optional(),
  customerRequest: z.string().optional(),
  internalNote: z.string().optional(),
  validUntil: z.string().optional(),
  estimatedLaborTotal: z.coerce.number().min(0, "İşçilik toplamı negatif olamaz").optional(),
  estimatedPartsTotal: z.coerce.number().min(0, "Parça toplamı negatif olamaz").optional(),
  discountAmount: z.coerce.number().min(0, "İndirim tutarı negatif olamaz").optional(),
  taxRate: z.coerce.number().min(0, "KDV oranı negatif olamaz").max(100, "KDV oranı en fazla %100 olabilir").optional(),
  grandTotal: z.coerce.number().min(0, "Genel toplam negatif olamaz").optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"]).optional(),
})

export const quoteStatusUpdateSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"], {
    error: "Geçerli bir durum seçiniz",
  }),
})