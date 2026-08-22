import { z } from "zod/v4"

export const quoteItemSchema = z.object({
  type: z.enum(["part", "labor"], { error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)" }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  // Katalog parça numarası ve birim — QuoteItem.sku / QuoteItem.unit kolonlarına yazılır.
  sku: z.string().nullable().optional().default(null),
  unit: z.string().optional().default("adet"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır"),
  // #179 — form artık iş emri kalem düzenleyicisini kullanıyor ve o düzenleyici
  // parayı KURUŞ tamsayısı olarak taşıyor. Form ile sunucu aynı birimi konuşur;
  // eski lira↔kuruş çevrim katmanı (ve onun yuvarlama riski) kalktı.
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").nullable(),
  totalPrice: z.coerce.number().int("Toplam fiyat kuruş (tam sayı) olmalıdır").min(0, "Toplam fiyat negatif olamaz").nullable(),
  note: z.string().optional().default(""),
  // Kendi stoğundan seçilen parça (DB PartStockItem.id) — boşsa manuel/katalog parçası.
  // Teklif stok düşMEZ, sadece partId bağlar; çevrim sırasında stok düşülür.
  partId: z.string().optional().default(""),
  // BakımX katalog ürünü (BAK-35). `partId` ile birlikte GELMEZ: BakımX stoğu
  // atölyenin stoğu değil, çevrimde de stok hareketi yaratmaz.
  bakimxProductId: z.string().optional().default(""),
  getirbakimProductId: z.string().optional().default(""),
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
  discountAmount: z.string().optional().default("0"), // kuruş (string in the form)
  taxRate: z.string().optional().default("2000"), // bps (2000 = %20)
  items: z.array(quoteItemSchema).default([]),
})

export type QuoteFormValues = z.infer<typeof quoteSchema>

// Action-side item schema (kept separate from the form quoteItemSchema to
// preserve server-action parsing behaviour: quantity defaults to 1, prices
// optional, note optional without a default).
export const quoteItemActionSchema = z.object({
  type: z.enum(["part", "labor"], { error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)" }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  sku: z.string().nullable().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  // Money is integer kuruş.
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().int("Toplam fiyat kuruş (tam sayı) olmalıdır").min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
  // Kendi stoğundan seçilen parça (DB PartStockItem.id). Teklif stok düşMEZ.
  partId: z.string().optional(),
  // BakımX katalog ürünü (BAK-35) — kalemin kaynağını çevrimden sonra da taşır.
  bakimxProductId: z.string().optional(),
  getirbakimProductId: z.string().optional(),
})

export const quoteCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().or(z.literal("")),
  title: z.string().optional(),
  customerRequest: z.string().optional(),
  internalNote: z.string().optional(),
  validUntil: z.string().optional(),
  // Money is integer kuruş; taxRate is integer bps (2000 = %20). The totals
  // (estimatedLaborTotal/estimatedPartsTotal/grandTotal) are RECOMPUTED on the
  // server from the line items — any client-sent value here is ignored.
  estimatedLaborTotal: z.coerce.number().int().min(0, "İşçilik toplamı negatif olamaz").optional(),
  estimatedPartsTotal: z.coerce.number().int().min(0, "Parça toplamı negatif olamaz").optional(),
  discountAmount: z.coerce.number().int("İndirim tutarı kuruş (tam sayı) olmalıdır").min(0, "İndirim tutarı negatif olamaz").optional(),
  taxRate: z.coerce.number().int("KDV oranı bps (tam sayı) olmalıdır").min(0, "KDV oranı negatif olamaz").max(10000, "KDV oranı en fazla %100 olabilir").optional(),
  grandTotal: z.coerce.number().int().min(0, "Genel toplam negatif olamaz").optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"]).optional(),
})

export const quoteStatusUpdateSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"], {
    error: "Geçerli bir durum seçiniz",
  }),
})