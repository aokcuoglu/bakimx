import type { QuoteItemFormValues } from "@/lib/validations/quote"

/**
 * Teklif kalemi ile iş emri kalem düzenleyicisinin satır biçimi arasındaki saf
 * dönüşüm (#179). Düzenleyici (`PartsLaborEditor`) `OrderItem` şeklinde satır
 * bekler; teklif formu ise `QuoteItemFormValues` tutar. İki taraf da parayı
 * KURUŞ tamsayısı olarak taşır — bu dosyada para dönüşümü YOKTUR.
 *
 * Teklifte saklanamayan alanlar (marka, kategori, TecDoc makale kimliği) bilerek
 * dışarıda bırakıldı: `QuoteItem` tablosunda karşılıkları yok. Düzenleyici teklif
 * modunda bu alanları göstermez (`showAttributes={false}`), böylece kullanıcıya
 * kaydedilmeyecek bir alan düzenletilmiş olmuyor.
 */
export type QuoteEditorRow = {
  id: string
  type: "part" | "labor"
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  /** kuruş */
  unitPrice: number | null
  /** kuruş */
  totalPrice: number | null
  note: string | null
  /** Atölyenin kendi stok kartı. Teklifte SADECE bağ kurar; stok hareketi yaratmaz. */
  partId: string | null
}

/** Düzenleyici yalnız part|labor üretmelidir; beklenmedik tip parçaya düşer. */
export function toQuoteItemType(type: string): "part" | "labor" {
  return type === "labor" ? "labor" : "part"
}

/** Satır → form kalemi (teklif gönderiminde JSON'a giren biçim). */
export function rowToQuoteItem(row: QuoteEditorRow): QuoteItemFormValues {
  return {
    type: toQuoteItemType(row.type),
    name: row.name.trim(),
    sku: row.sku?.trim() || null,
    unit: row.unit?.trim() || "adet",
    quantity: row.quantity > 0 ? row.quantity : 1,
    unitPrice: row.unitPrice != null && row.unitPrice > 0 ? Math.trunc(row.unitPrice) : null,
    totalPrice: row.totalPrice != null && row.totalPrice > 0 ? Math.trunc(row.totalPrice) : null,
    note: row.note ?? "",
    partId: row.partId ?? "",
  }
}

/** Form kalemi → satır. `id` çağıran tarafından verilir (liste anahtarı). */
export function quoteItemToRow(item: QuoteItemFormValues, id: string): QuoteEditorRow {
  return {
    id,
    type: toQuoteItemType(item.type),
    name: item.name,
    sku: item.sku ?? null,
    unit: item.unit || "adet",
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? null,
    totalPrice: item.totalPrice ?? null,
    note: item.note || null,
    partId: item.partId || null,
  }
}

/** Adsız satırlar teklife yazılmaz (composer taslağı / yarım kalmış satır). */
export function rowsToQuoteItems(rows: QuoteEditorRow[]): QuoteItemFormValues[] {
  return rows.filter((r) => r.name.trim() !== "").map(rowToQuoteItem)
}
