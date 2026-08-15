import { z } from "zod/v4"

export const serviceOrderItemSchema = z.object({
  type: z.enum(["part", "labor", "external_labor"], {
    error: "Geçerli bir kalem tipi seçiniz (parça/işçilik/dış işçilik)",
  }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  // Money is integer kuruş (client converts TRY -> kuruş before submit).
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().int("Toplam fiyat kuruş (tam sayı) olmalıdır").min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
  // Kendi stoğundan seçilen parça (DB PartStockItem.id) — boşsa manuel/katalog parçası.
  partId: z.string().optional(),
  // TecDoc katalog bağı — parça araç kataloğundan seçildiyse dolu
  tecdocArticleId: z.coerce.number().int("TecDoc parça no tam sayı olmalıdır").positive().optional(),
  // Parça markası (TecDoc supplier adı veya serbest metin).
  brand: z.string().optional(),
  // Seçilen kategori etiketi (yaprak düğüm adı veya serbest metin).
  category: z.string().optional(),
  // TecDoc kategori düğüm id'si; serbest metin kategoride gönderilmez.
  categoryId: z.coerce.number().int("Kategori id tam sayı olmalıdır").positive().optional(),
  // BakımX katalog ürünü (BAK-35). Doluysa kalemin kimlik/fiyat alanları SUNUCUDA
  // ürün kaydından türetilir — istemciden gelen ad/fiyat yazılmaz.
  bakimxProductId: z.string().optional(),
  // Per-row VAT inclusion toggle: true = includes 20% VAT in displayed price
  includeVat: z.coerce.boolean().optional(),
})

/**
 * İş emri kalemi kısmi güncelleme şeması — yalnızca gönderilen alanlar güncellenir.
 * quantity/unitPrice create ile aynı kurallara tabidir; hepsi optional.
 */
export const serviceOrderItemUpdateSchema = z.object({
  name: z.string().min(1, "Kalem adı boş olamaz").optional(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").optional(),
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").optional(),
  note: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.coerce.number().int("Kategori id tam sayı olmalıdır").positive().nullable().optional(),
  // Katalogdan parça seçilince kurulur / serbest metne dönülünce (boş string) temizlenir.
  tecdocArticleId: z.coerce.number().int("TecDoc parça no tam sayı olmalıdır").positive().nullable().optional(),
  // Per-row VAT inclusion toggle: true = includes 20% VAT in displayed price
  includeVat: z.coerce.boolean().optional(),
})

/**
 * Teknisyenin dışarıdan aldığı parça (source=purchase) kalemi oluşturma şeması.
 * Para değerleri kuruş; client TRY→kuruş çevirir. purchasedAt (dd.MM.yyyy) ve
 * fotoğraf action tarafında ayrıca ele alınır.
 */
export const purchaseItemCreateSchema = z.object({
  name: z.string().min(1, "Parça adı zorunludur"),
  sku: z.string().optional(),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  purchasePriceKurus: z.coerce
    .number()
    .int("Alış fiyatı kuruş (tam sayı) olmalıdır")
    .min(0, "Alış fiyatı negatif olamaz"),
  supplierName: z.string().optional(),
  supplierId: z.string().optional(),
  purchasedById: z.string().optional(),
})

/**
 * Dış alım kalemi düzenleme şeması (masa tarafı detay modal'ı). Satış unitPrice'ı
 * grid'deki mevcut alandan bağımsız düzenlenir; burada YER ALMAZ.
 */
export const purchaseItemUpdateSchema = z.object({
  purchasePriceKurus: z.coerce
    .number()
    .int("Alış fiyatı kuruş (tam sayı) olmalıdır")
    .min(0, "Alış fiyatı negatif olamaz")
    .optional(),
  supplierName: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
})

/**
 * Fatura bilgisi elle girilir (fatura entegrasyonu yok). İki alan da boş
 * bırakılabilir — boş değer alanı temizler. Tarih, DatePicker'ın depolama
 * biçiminde (GG.AA.YYYY) gelir; sunucu tarafında `trDateToDate` ile Date'e çevrilir.
 */
export const orderInvoiceSchema = z.object({
  invoiceNo: z.string().trim().max(50, "Fatura numarası en fazla 50 karakter olabilir"),
  invoiceDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{2}\.\d{2}\.\d{4}$/.test(v), "Geçerli bir tarih seçiniz"),
})
