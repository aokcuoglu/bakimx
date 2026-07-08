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
  categoryId: z.coerce.number().int("Kategori id tam sayı olmalıdır").positive().optional(),
})