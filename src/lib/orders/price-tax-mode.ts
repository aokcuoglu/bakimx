/**
 * Kalem düzenleyicisinin KDV DAHİL / HARİÇ fiyat kipi (#311).
 *
 * SÖZLEŞME
 * --------
 * Kalem `unitPrice`'ı veritabanında HER ZAMAN KDV HARİÇ (net) kuruştur; KDV tek
 * noktada, belge düzeyindeki `taxRate` (bps) ile Genel Toplam'a eklenir
 * (`src/lib/totals.ts`). Bu modül o invaryantı DEĞİŞTİRMEZ: yalnız kullanıcının
 * gördüğü/yazdığı tutarı çevirir.
 *
 * - kip `excluded` (varsayılan): bugünkü davranış — yazılan tutar net, gösterilen
 *   tutar net.
 * - kip `included`: yazılan tutar KDV dahildir → net'e çevrilip saklanır;
 *   saklanan net ise ekranda KDV dahil olarak gösterilir.
 *
 * Yuvarlama: net→brüt→net gidiş-dönüşü %20 KDV'de tam lira ve 10 kuruşluk
 * tutarlarda birebir kapanır; ondalık kuruşlu girişlerde (ör. ₺0,75 KDV dahil)
 * en fazla 1 kuruş kayabilir — brüt tutarların tamamı net tabandan üretilemez.
 */

import { grossFromNetKurus, netFromGrossKurus } from "@/lib/money"

/** İşçilik/parça için Türkiye'de standart KDV oranı (bps). */
export const STANDARD_TAX_BPS = 2000

export type PriceTaxMode = "excluded" | "included"

/** Kip tarayıcıda hatırlanır: aynı atölye fiyatlarını hep aynı şekilde girer. */
export const PRICE_TAX_MODE_STORAGE_KEY = "bakimx:price-tax-mode"

/**
 * Çevrimde kullanılacak oran: belgenin KDV oranı tanımlıysa o, değilse standart
 * %20. Belgede oran yokken KDV dahil kipine geçen kullanıcı Genel Toplam'ın
 * KDV'siz kaldığı konusunda düzenleyicide uyarılır (bkz. PartsLaborEditor).
 */
export function effectiveTaxBps(documentTaxBps: number | null | undefined): number {
  const bps = Math.trunc(documentTaxBps ?? 0)
  return bps > 0 ? bps : STANDARD_TAX_BPS
}

/** Kullanıcının yazdığı tutar (kuruş) → saklanacak net birim fiyat (kuruş). */
export function toStoredPriceKurus(enteredKurus: number, mode: PriceTaxMode, taxBps: number): number {
  return mode === "included" ? netFromGrossKurus(enteredKurus, taxBps) : Math.trunc(enteredKurus)
}

/** Saklanan net tutar (kuruş) → ekranda gösterilecek tutar (kuruş). */
export function toDisplayPriceKurus(storedKurus: number, mode: PriceTaxMode, taxBps: number): number {
  return mode === "included" ? grossFromNetKurus(storedKurus, taxBps) : Math.trunc(storedKurus)
}

/** `null` (fiyat girilmedi) durumunu koruyan gösterim çevrimi. */
export function toDisplayPriceKurusOrNull(
  storedKurus: number | null,
  mode: PriceTaxMode,
  taxBps: number
): number | null {
  return storedKurus == null ? null : toDisplayPriceKurus(storedKurus, mode, taxBps)
}

export function isPriceTaxMode(value: unknown): value is PriceTaxMode {
  return value === "included" || value === "excluded"
}

/** Yeni kullanıcılar fiyatı müşteriye söylendiği biçimde, KDV dahil görür ve girer. */
export function resolvePriceTaxMode(value: unknown): PriceTaxMode {
  return isPriceTaxMode(value) ? value : "included"
}

/** localStorage'daki kip; okunamazsa (SSR, gizli mod, bozuk değer) `included`. */
export function readPriceTaxMode(): PriceTaxMode {
  if (typeof window === "undefined") return "included"
  try {
    const stored = window.localStorage.getItem(PRICE_TAX_MODE_STORAGE_KEY)
    return resolvePriceTaxMode(stored)
  } catch {
    return "included"
  }
}

/** Kipi kalıcılaştır. Yazma başarısızsa sessizce geçilir — kip yalnız görünüm. */
export function writePriceTaxMode(mode: PriceTaxMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PRICE_TAX_MODE_STORAGE_KEY, mode)
  } catch {
    // yok sayılır
  }
}
