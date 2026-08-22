import { z } from "zod/v4"

/**
 * BakımX ürün kataloğunun doğrulama şemaları (BAK-32).
 *
 * İKİ KATMAN — projedeki `part.ts` kalıbının aynısı:
 * - `*FormSchema`: tarayıcıdaki react-hook-form katmanı. Fiyatlar LİRA, sayısal
 *   olmayabilen alanlar (maliyet, tedarik süresi) boş METİN olabilir.
 * - `*InputSchema`: server action katmanı. Fiyatlar KURUŞ (tam sayı), her alan
 *   kesin tipli. Lira ↔ kuruş dönüşümü yalnız UI sınırında yapılır
 *   (`src/lib/money.ts`), sunucu asla lira görmez.
 *
 * Sunucu şeması tek gerçek kapıdır: form atlansa bile action aynı kuralları
 * uygular (admin layout guard'ı action'lara miras kalmıyor).
 */

/** Boş bırakılabilen http(s) adresi — logo / görsel alanları. */
const optionalUrl = z
  .string()
  .trim()
  .max(500, "Adres en fazla 500 karakter olabilir")
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Geçerli bir http(s) adresi girin")
  .optional()
  .default("")

/** Boş bırakılabilen pozitif sayı metni (form katmanı): "" | "12" | "12,5". */
const optionalNumericText = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (Number.isFinite(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0),
    "Geçerli bir sayı girin",
  )
  .optional()
  .default("")

/** 1 milyar kuruş = 10.000.000 ₺ — katalogda tek bir kalemin makul üst sınırı. */
const MAX_PRICE_KURUS = 1_000_000_000
const MAX_STOCK_QTY = 1_000_000

// ---------------------------------------------------------------------------
// Ürün
// ---------------------------------------------------------------------------

export const bakimxProductFormSchema = z.object({
  sku: z.string().trim().min(1, "Ürün kodu zorunludur").max(60, "Ürün kodu en fazla 60 karakter olabilir"),
  name: z.string().trim().min(1, "Ürün adı zorunludur").max(200, "Ürün adı en fazla 200 karakter olabilir"),
  brandId: z.string().min(1, "Marka seçilmelidir"),
  categoryKey: z.string().optional().default(""),
  tecdocCategoryId: z.coerce.number().int().positive("Geçerli TecDoc kategorisi seçin").optional().nullable().default(null),
  barcode: z.string().trim().max(60, "Barkod en fazla 60 karakter olabilir").optional().default(""),
  unit: z.string().trim().min(1, "Birim zorunludur").max(20, "Birim en fazla 20 karakter olabilir").default("adet"),
  description: z.string().trim().max(2000, "Açıklama en fazla 2000 karakter olabilir").optional().default(""),
  imageUrl: optionalUrl,
  /** Serbest metin: virgül / satır sonu ile ayrılır, `parseOemNumbers` ile diziye iner. */
  oemNumbers: z.string().max(2000, "OEM listesi en fazla 2000 karakter olabilir").optional().default(""),
  crossReferences: z.string().max(4000, "Cross-reference listesi en fazla 4000 karakter olabilir").optional().default(""),
  /** LİRA, KDV HARİÇ — atölyenin BakımX'ten alış fiyatı. */
  workshopPrice: z.coerce.number().min(0, "Fiyat negatif olamaz").max(10_000_000, "Fiyat çok yüksek"),
  /** Yüzde (20 = %20); kuruş tarafında bps'e çevrilir. */
  vatRate: z.coerce.number().min(0, "KDV oranı negatif olamaz").max(100, "KDV oranı %100'ü geçemez").default(20),
  /** LİRA — BakımX'in iç maliyeti; boş bırakılabilir, atölye yüzeyine çıkmaz. */
  costPrice: optionalNumericText,
  stockQty: z.coerce.number().int("Stok tam sayı olmalıdır").min(0, "Stok negatif olamaz").max(MAX_STOCK_QTY, "Stok çok yüksek").default(0),
  lowStockQty: z.coerce.number().int("Kritik stok tam sayı olmalıdır").min(0, "Kritik stok negatif olamaz").max(MAX_STOCK_QTY, "Kritik stok çok yüksek").default(0),
  backorderable: z.boolean().default(false),
  leadTimeDays: optionalNumericText,
  isActive: z.boolean().default(true),
  fitmentScope: z.enum(["universal", "vehicle_linked"]).default("universal"),
  vehicleTypeIds: z.array(z.coerce.number().int().positive()).default([]),
}).refine(
  (data) => data.fitmentScope !== "vehicle_linked" || data.vehicleTypeIds.length > 0,
  { message: "Araç bazlı ürün en az bir araç tipi seçmelidir", path: ["vehicleTypeIds"] }
)

export type BakimxProductFormValues = z.infer<typeof bakimxProductFormSchema>

export const bakimxProductInputSchema = z.object({
  sku: z.string().trim().min(1, "Ürün kodu zorunludur").max(60, "Ürün kodu en fazla 60 karakter olabilir"),
  name: z.string().trim().min(1, "Ürün adı zorunludur").max(200, "Ürün adı en fazla 200 karakter olabilir"),
  brandId: z.string().min(1, "Marka seçilmelidir"),
  categoryKey: z.string().trim().max(60).optional().default(""),
  tecdocCategoryId: z.coerce.number().int().positive().optional().nullable().default(null),
  barcode: z.string().trim().max(60).optional().default(""),
  unit: z.string().trim().min(1, "Birim zorunludur").max(20).default("adet"),
  description: z.string().trim().max(2000).optional().default(""),
  imageUrl: optionalUrl,
  oemNumbers: z.array(z.string().trim().min(1)).max(50, "En fazla 50 OEM numarası girilebilir").default([]),
  crossReferences: z.array(z.string().trim().min(1)).max(100, "En fazla 100 cross-reference kodu girilebilir").default([]),
  /** KURUŞ, KDV HARİÇ. */
  workshopPriceKurus: z.coerce
    .number()
    .int("Fiyat kuruş (tam sayı) olmalıdır")
    .min(0, "Fiyat negatif olamaz")
    .max(MAX_PRICE_KURUS, "Fiyat çok yüksek"),
  vatRateBps: z.coerce
    .number()
    .int("KDV oranı bps (tam sayı) olmalıdır")
    .min(0, "KDV oranı negatif olamaz")
    .max(10000, "KDV oranı %100'ü geçemez"),
  costPriceKurus: z.coerce
    .number()
    .int("Maliyet kuruş (tam sayı) olmalıdır")
    .min(0, "Maliyet negatif olamaz")
    .max(MAX_PRICE_KURUS, "Maliyet çok yüksek")
    .nullable()
    .default(null),
  stockQty: z.coerce.number().int("Stok tam sayı olmalıdır").min(0, "Stok negatif olamaz").max(MAX_STOCK_QTY).default(0),
  lowStockQty: z.coerce.number().int("Kritik stok tam sayı olmalıdır").min(0, "Kritik stok negatif olamaz").max(MAX_STOCK_QTY).default(0),
  backorderable: z.boolean().default(false),
  leadTimeDays: z.coerce
    .number()
    .int("Tedarik süresi tam sayı olmalıdır")
    .min(0, "Tedarik süresi negatif olamaz")
    .max(365, "Tedarik süresi en fazla 365 gün olabilir")
    .nullable()
    .default(null),
  isActive: z.boolean().default(true),
  fitmentScope: z.enum(["universal", "vehicle_linked"]).default("universal"),
  vehicleTypeIds: z.array(z.coerce.number().int().positive()).default([]),
}).refine(
  (data) => data.fitmentScope !== "vehicle_linked" || data.vehicleTypeIds.length > 0,
  { message: "Araç bazlı ürün en az bir araç tipi seçmelidir", path: ["vehicleTypeIds"] }
)

export type BakimxProductInput = z.infer<typeof bakimxProductInputSchema>

// ---------------------------------------------------------------------------
// Marka
// ---------------------------------------------------------------------------

export const bakimxBrandFormSchema = z.object({
  name: z.string().trim().min(1, "Marka adı zorunludur").max(120, "Marka adı en fazla 120 karakter olabilir"),
  logoUrl: optionalUrl,
  isActive: z.boolean().default(true),
})

export type BakimxBrandFormValues = z.infer<typeof bakimxBrandFormSchema>

export const bakimxBrandInputSchema = bakimxBrandFormSchema

export type BakimxBrandInput = z.infer<typeof bakimxBrandInputSchema>

// ---------------------------------------------------------------------------
// Toplu işlemler
// ---------------------------------------------------------------------------

/**
 * Toplu işlem seçimi. Üst sınır 200: her satır tek tek okunup güncelleniyor ve
 * denetim kaydı yazılıyor; tek interaktif transaction'ın süresi bu ölçekte
 * güvenli kalıyor (içe aktarım gibi binlerce satırlık iş BAK-34'te toplu
 * statement'larla yapılır).
 */
export const BULK_SELECTION_LIMIT = 200

const bulkSelection = z
  .array(z.string().min(1))
  .min(1, "En az bir ürün seçilmelidir")
  .max(BULK_SELECTION_LIMIT, `Tek seferde en fazla ${BULK_SELECTION_LIMIT} ürün güncellenebilir`)

export const bakimxBulkActiveSchema = z.object({
  productIds: bulkSelection,
  isActive: z.boolean(),
})

export const bakimxBulkPriceSchema = z.object({
  productIds: bulkSelection,
  /** Yüzde: -90 (indirim) ile +500 (zam) arası; 0 anlamsız olduğu için reddedilir. */
  percent: z.coerce
    .number()
    .min(-90, "Yüzde -90'dan küçük olamaz")
    .max(500, "Yüzde 500'den büyük olamaz")
    .refine((v) => v !== 0, "Yüzde 0 olamaz"),
})

export const bakimxBulkStockSchema = z.object({
  productIds: bulkSelection,
  mode: z.enum(["set", "increase", "decrease"], { error: "Geçerli bir stok işlemi seçin" }),
  quantity: z.coerce
    .number()
    .int("Miktar tam sayı olmalıdır")
    .min(0, "Miktar negatif olamaz")
    .max(MAX_STOCK_QTY, "Miktar çok yüksek"),
})
