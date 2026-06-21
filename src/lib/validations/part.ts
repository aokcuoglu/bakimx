import { z } from "zod"

export const partSchema = z.object({
  name: z.string().min(1, "Parça adı zorunludur"),
  sku: z.string().optional().default(""),
  oemNo: z.string().optional().default(""),
  brand: z.string().optional().default(""),
  category: z.string().optional().default(""),
  description: z.string().optional().default(""),
  unit: z.string().min(1, "Birim zorunludur").default("adet"),
  stockQty: z.coerce.number().min(0).default(0),
  criticalStockQty: z.coerce.number().min(0).default(0),
  purchasePrice: z.coerce.number().min(0).optional().default(0),
  salePrice: z.coerce.number().min(0).optional().default(0),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  supplierName: z.string().optional().default(""),
  supplierPhone: z.string().optional().default(""),
  supplierId: z.string().optional().default(""),
  shelfLocation: z.string().optional().default(""),
  barcode: z.string().optional().default(""),
})

export type PartFormValues = z.infer<typeof partSchema>