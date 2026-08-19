import { z } from "zod/v4"
import { parseTRYToKurus } from "@/lib/money"

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

/**
 * Talep tipi (BAK-105). `part` varsayılandır — tip alanı hiç gönderilmezse
 * bugünkü davranış aynen korunur.
 */
export const PARTS_REQUEST_TYPES = ["part", "external_labor"] as const
export type PartsRequestTypeKey = (typeof PARTS_REQUEST_TYPES)[number]

export const partsRequestSchema = z
  .object({
    serviceOrderId: z.string().min(1, "İş emri zorunludur"),
    type: z.enum(PARTS_REQUEST_TYPES).default("part"),
    // Zorunluluk superRefine'da: hata metni tipe göre değişiyor ("Parça adı" /
    // "İşçilik adı") ve min(1) buradan önce ateşlerse o metin hiç görünmez.
    partName: z.string().max(200),
    partSku: z.string().optional().or(z.literal("")),
    quantity: z
      .union([z.coerce.number().int().min(1, "Miktar en az 1 olmalıdır"), z.null()])
      .transform((v) => v ?? 1)
      .default(1),
    note: z.string().optional().or(z.literal("")),
    /** Katalogdan seçildiyse parça markası; serbest metin talebinde boş. */
    brand: z.string().max(120).optional().or(z.literal("")),
    /** Katalogdan seçildiyse TecDoc article id; boş string → undefined. */
    tecdocArticleId: z
      .union([z.literal(""), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? undefined : v)),
    /** YALNIZ dış işçilikte: işi yapan firma (serbest metin). */
    supplierName: z.string().trim().max(160).optional().or(z.literal("")),
    /**
     * YALNIZ dış işçilikte: tahmini tutar, kullanıcının yazdığı TL metni
     * ("1.250,50" / "1250.5" / "₺900"). Kuruşa çevirme `parseTRYToKurus` ile
     * tek yerden yapılır; boş/geçersiz metin → undefined (tutar bildirilmedi).
     */
    estimatedPrice: z.string().max(20).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.partName.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["partName"],
        message: data.type === "external_labor" ? "İşçilik adı zorunludur" : "Parça adı zorunludur",
      })
    }
  })
  // Tipe göre ALAN TEMİZLİĞİ tek yerde: istemci ne gönderirse göndersin, parça
  // alanları dış işçilik talebine, tutar/firma alanları da parça talebine
  // sızamaz. Böylece kaleme çevirme (parts-request-item.ts) tek bir kaydın
  // içinde tutarlı veri bulur.
  .transform((data) => {
    const isExternalLabor = data.type === "external_labor"
    return {
      ...data,
      partName: data.partName.trim(),
      partSku: isExternalLabor ? "" : data.partSku,
      brand: isExternalLabor ? "" : data.brand,
      tecdocArticleId: isExternalLabor ? undefined : data.tecdocArticleId,
      supplierName: isExternalLabor ? data.supplierName : "",
      // Dış işçilik tek iştir: miktar sorulmaz, 1'e sabitlenir (detay nota yazılır).
      quantity: isExternalLabor ? 1 : data.quantity,
      estimatedPriceKurus: isExternalLabor
        ? (parseTRYToKurus(data.estimatedPrice ?? "") ?? undefined)
        : undefined,
    }
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

// ── İşçilik süresi kaydı (BAK-138) ───────────────────────────────────────────

/** Not alanının üst sınırı — "bu sürede ne yapıldı" bir özet, rapor değil. */
export const LABOR_SESSION_NOTE_MAX = 500

const laborSessionNoteField = z
  .string()
  .trim()
  .max(LABOR_SESSION_NOTE_MAX, `Açıklama en fazla ${LABOR_SESSION_NOTE_MAX} karakter olabilir`)
  .optional()
  .or(z.literal(""))

/**
 * Sayacı durdururken girilen açıklama. Zorunlu DEĞİL: teknisyenin elini kolunu
 * bağlamamalı, not sonradan da eklenebiliyor.
 */
export const laborSessionNoteSchema = z.object({ note: laborSessionNoteField })

export type LaborSessionNoteInput = z.infer<typeof laborSessionNoteSchema>

/**
 * Aralık kuralları — TEK KAYNAK. Hem istemci formu (yerel `datetime-local`
 * metni) hem sunucu şeması (ISO/UTC) buradan geçer; kural iki yere kopyalanırsa
 * biri güncellenip diğeri unutulur ve sunucu formun kabul ettiğini reddeder.
 */
export function laborSessionRangeError(
  start: Date,
  end: Date,
): { field: "start" | "end"; message: string } | null {
  if (Number.isNaN(start.getTime())) return { field: "start", message: "Geçerli bir başlangıç saati giriniz" }
  if (Number.isNaN(end.getTime())) return { field: "end", message: "Geçerli bir bitiş saati giriniz" }
  if (end.getTime() <= start.getTime()) {
    return { field: "end", message: "Bitiş saati başlangıçtan sonra olmalıdır" }
  }
  // Gelecek yasak: işçilik süresi ÖLÇÜLEN bir şeydir, planlanan değil. Bir
  // dakikalık pay istemci/sunucu saat farkı için — kullanıcı "şimdi"yi seçtiğinde
  // saniye farkıyla reddedilmesin.
  const limit = Date.now() + 60_000
  if (start.getTime() > limit) return { field: "start", message: "Başlangıç saati gelecekte olamaz" }
  if (end.getTime() > limit) return { field: "end", message: "Bitiş saati gelecekte olamaz" }
  return null
}

/**
 * SUNUCU şeması: bitmiş bir işçilik süresi kaydının elle düzeltilmesi.
 *
 * Saatler ISO-8601 (UTC) gelir — form `datetime-local` gösterir ama istemci
 * göndermeden önce `toISOString()` ile çevirir. Yerel saat metnini
 * ("2026-08-19T18:40") sunucuda parse etmek, sunucu UTC'de koştuğu için
 * atölyenin saatini kaydırırdı.
 *
 * `durationMinutes` BİLEREK alınmaz: süre her zaman aralıktan türetilir, iki
 * ayrı doğruluk kaynağı olmaz.
 */
export const laborSessionEditSchema = z
  .object({
    startTime: z.coerce.date({ error: "Geçerli bir başlangıç saati giriniz" }),
    endTime: z.coerce.date({ error: "Geçerli bir bitiş saati giriniz" }),
    note: laborSessionNoteField,
  })
  .superRefine((data, ctx) => {
    const err = laborSessionRangeError(data.startTime, data.endTime)
    if (err) {
      ctx.addIssue({ code: "custom", path: [err.field === "start" ? "startTime" : "endTime"], message: err.message })
    }
  })

export type LaborSessionEditInput = z.infer<typeof laborSessionEditSchema>

/**
 * İSTEMCİ şeması: alanlar `datetime-local` girdisinin ürettiği YEREL saat
 * metnidir ("2026-08-19T18:40"). `new Date(...)` tarayıcıda bunu yerel saat
 * olarak çözer, gönderimde `toISOString()` UTC'ye çevirir.
 */
export const laborSessionEditFormSchema = z
  .object({
    startLocal: z.string().min(1, "Başlangıç saati zorunludur"),
    endLocal: z.string().min(1, "Bitiş saati zorunludur"),
    note: laborSessionNoteField,
  })
  .superRefine((data, ctx) => {
    if (!data.startLocal || !data.endLocal) return
    const err = laborSessionRangeError(new Date(data.startLocal), new Date(data.endLocal))
    if (err) {
      ctx.addIssue({ code: "custom", path: [err.field === "start" ? "startLocal" : "endLocal"], message: err.message })
    }
  })

export type LaborSessionEditFormInput = z.infer<typeof laborSessionEditFormSchema>
