import { z } from "zod/v4"

const optionalPartAttributeSchema = z.string().trim().max(120, "En fazla 120 karakter girilebilir").optional().default("")
const optionalPartAttributeServerSchema = z.string().trim().max(120, "En fazla 120 karakter girilebilir").optional().or(z.literal(""))

/** Form katmanı: fiyat TRY (lira) girilir. */
export const partSupplierPriceFormRowSchema = z.object({
  supplierId: z.string().min(1, "Tedarikçi seçilmelidir"),
  purchasePrice: z.coerce.number().min(0, "Alış fiyatı negatif olamaz").default(0),
  supplierSku: z.string().optional().default(""),
  isPreferred: z.boolean().default(false),
})

/** Sunucu katmanı: fiyat kuruş (tam sayı). */
export const partSupplierPriceRowSchema = z.object({
  supplierId: z.string().min(1, "Tedarikçi seçilmelidir"),
  purchasePrice: z.coerce
    .number()
    .int("Alış fiyatı kuruş (tam sayı) olmalıdır")
    .min(0, "Alış fiyatı negatif olamaz"),
  supplierSku: z.string().optional().default(""),
  isPreferred: z.boolean().default(false),
})

function withRowRules<T extends z.ZodType<{ supplierId: string; isPreferred: boolean }[]>>(schema: T) {
  return schema
    .refine(
      (rows) => new Set(rows.map((r) => r.supplierId)).size === rows.length,
      "Aynı tedarikçi birden fazla eklenemez"
    )
    .refine(
      (rows) => rows.length === 0 || rows.filter((r) => r.isPreferred).length === 1,
      "Bir varsayılan tedarikçi seçilmelidir"
    )
}

export const partSupplierPricesFormSchema = withRowRules(
  z.array(partSupplierPriceFormRowSchema).max(20, "En fazla 20 tedarikçi eklenebilir")
)

export const partSupplierPricesSchema = withRowRules(
  z.array(partSupplierPriceRowSchema).max(20, "En fazla 20 tedarikçi eklenebilir")
)

export const partSchema = z.object({
  name: z.string().min(1, "Parça adı zorunludur"),
  sku: z.string().min(1, "Parça kodu zorunludur"),
  oemNo: z.string().optional().default(""),
  brand: optionalPartAttributeSchema,
  category: optionalPartAttributeSchema,
  description: z.string().optional().default(""),
  unit: z.string().min(1, "Birim zorunludur").default("adet"),
  stockQty: z.coerce.number().min(0).default(0),
  criticalStockQty: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).optional().default(0), // TRY in the form; converted to kuruş on submit
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  supplierName: z.string().optional().default(""),
  supplierPhone: z.string().optional().default(""),
  supplierId: z.string().optional().default(""),
  shelfLocation: z.string().optional().default(""),
  barcode: z.string().optional().default(""),
  supplierPrices: partSupplierPricesFormSchema.default([]),
})

export type PartFormValues = z.infer<typeof partSchema>

export const partCreateSchema = z.object({
  name: z.string().min(1, "Parça adı zorunludur"),
  sku: z.string().min(1, "Parça kodu zorunludur"),
  oemNo: z.string().optional().or(z.literal("")),
  brand: optionalPartAttributeServerSchema,
  category: optionalPartAttributeServerSchema,
  description: z.string().optional().or(z.literal("")),
  unit: z.string().default("adet"),
  stockQty: z.coerce.number().int("Stok miktarı tam sayı olmalıdır").min(0, "Stok miktarı negatif olamaz").default(0),
  criticalStockQty: z.coerce.number().int("Kritik stok miktarı tam sayı olmalıdır").min(0, "Kritik stok miktarı negatif olamaz").default(0),
  purchasePrice: z.coerce.number().int("Alış fiyatı kuruş (tam sayı) olmalıdır").min(0, "Alış fiyatı negatif olamaz").optional(), // kuruş
  salePrice: z.coerce.number().int("Satış fiyatı kuruş (tam sayı) olmalıdır").min(0, "Satış fiyatı negatif olamaz").optional(), // kuruş
  currency: z.string().default("TRY"),
  supplierName: z.string().optional().or(z.literal("")),
  supplierPhone: z.string().optional().or(z.literal("")),
  supplierId: z.string().optional().or(z.literal("")),
  shelfLocation: z.string().optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
})

export const partUpdateSchema = partCreateSchema

export const stockMovementSchema = z.object({
  partId: z.string().min(1, "Parça seçimi zorunludur"),
  type: z.enum(["in", "out", "adjustment"], { error: "Geçerli bir hareket tipi seçiniz" }),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır"),
  reason: z.string().optional().or(z.literal("")),
})
