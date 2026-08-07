/**
 * İş emri "Oluştur & Düzenle" modalının gönderim öncesi kuralları (#210).
 *
 * Modal iki modda çalışır: "Stok kartı olarak kaydet" AÇIK iken kalıcı bir
 * PartStockItem açılır (stok kodu zorunlu), KAPALI iken bugünkü davranış korunur
 * (tek seferlik manuel kalem, kod isteğe bağlı). Kural bileşenden ayrı tutulur ki
 * saf fonksiyon olarak test edilebilsin (bkz. part-attribute-commit.ts deseni).
 */

/**
 * `createQuickPartAction` sonucu. Ayrık birleşim olarak BURADA tanımlanır:
 * action dosyasında çıkarımla bırakılırsa TypeScript her iki dalı da
 * `error?: undefined` gibi isteğe bağlı alanlarla birleştiriyor ve çağıran
 * taraftaki `"error" in res` daraltması başarı dalını doğru tiplemiyor.
 */
export type QuickPartCreateResult =
  | { error: string }
  | { success: true; id: string; sku: string; name: string }

export type QuickPartDraftInput = {
  name: string
  sku: string
  createStockItem: boolean
}

export const QUICK_PART_NAME_REQUIRED = "Parça adı zorunludur"
export const QUICK_PART_SKU_REQUIRED = "Stok kartı için stok kodu zorunludur"

/** Hata mesajı döner; taslak gönderilebilir durumdaysa `null`. */
export function validateQuickPartDraft(input: QuickPartDraftInput): string | null {
  if (!input.name.trim()) return QUICK_PART_NAME_REQUIRED
  if (input.createStockItem && !input.sku.trim()) return QUICK_PART_SKU_REQUIRED
  return null
}
