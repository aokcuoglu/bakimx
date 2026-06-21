import { z } from "zod"

export const collectionSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  serviceOrderId: z.string().optional().default(""),
  amount: z.coerce.number().positive("Tutar sıfırdan büyük olmalıdır"),
  method: z.enum(["cash", "credit_card", "bank_transfer", "other"]),
  paymentDate: z.string().min(1, "Tahsilat tarihi zorunludur"),
  referenceNo: z.string().optional().default(""),
  note: z.string().optional().default(""),
})

export type CollectionFormValues = z.infer<typeof collectionSchema>