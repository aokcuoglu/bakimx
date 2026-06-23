import { z } from "zod/v4"

export const checklistItemSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  category: z.enum(["inspection", "repair", "delivery"], {
    error: "Geçerli bir kategori seçiniz",
  }),
  description: z.string().min(1, "Açıklama zorunludur").max(500),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const internalNoteSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  content: z.string().min(1, "Not içeriği zorunludur").max(2000),
})

export const partsRequestSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  partName: z.string().min(1, "Parça adı zorunludur").max(200),
  partSku: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Miktar en az 1 olmalıdır").default(1),
  note: z.string().optional().or(z.literal("")),
})