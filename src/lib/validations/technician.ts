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
  /** Katalogdan seçildiyse parça markası; serbest metin talebinde boş. */
  brand: z.string().max(120).optional().or(z.literal("")),
  /** Katalogdan seçildiyse TecDoc article id; boş string → undefined. */
  tecdocArticleId: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
})

/**
 * Ofisin bekleyen bir parça talebinde düzelttiği alanlar.
 *
 * `serviceOrderId` ve `tecdocArticleId` BİLEREK yok: talep başka bir iş emrine
 * taşınamaz, katalog eşleşmesi de elle değiştirilemez (eşleşme talebi oluşturan
 * aramadan gelir — elle girilen bir id yanlış parçayı kaleme taşırdı).
 * `partSku`/`brand`/`note` boş bırakılabilir; boş string sunucuda `null` olur.
 */
export const partsRequestEditSchema = z.object({
  partName: z.string().trim().min(1, "Parça adı zorunludur").max(200),
  partSku: z.string().trim().max(120).optional().or(z.literal("")),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Miktar en az 1 olmalıdır").max(999, "Miktar en fazla 999 olabilir"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
})

export type PartsRequestEditInput = z.infer<typeof partsRequestEditSchema>

/** İptal gerekçesi — atölye içi not, zorunlu değildir. */
export const partsRequestCancelSchema = z.object({
  reason: z.string().trim().max(300, "Gerekçe en fazla 300 karakter olabilir").optional().or(z.literal("")),
})

export type PartsRequestCancelInput = z.infer<typeof partsRequestCancelSchema>
