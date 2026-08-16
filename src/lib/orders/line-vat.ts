/**
 * Satır bazlı KDV — kalem düzenleyicisinin KDV sözleşmesi (BAK-75).
 *
 * SÖZLEŞME
 * --------
 * - Kalem `unitPrice` veritabanında HER ZAMAN KDV HARİÇ (net) kuruştur ve ekranda
 *   da NET gösterilir. Kullanıcı ne yazdıysa onu görür; gizli net↔brüt çevrimi
 *   YOKTUR. ₺100 yazan biri satırda ₺100 okur.
 * - Satırın `includeVat` bayrağı "bu satıra KDV EKLENSİN" demektir ve varsayılanı
 *   KAPALI'dır: %20 kimseye sorulmadan tutara girmez (BAK-75 §1).
 * - Tick açıkken satır Genel Toplam'a net tutarıyla girer, KDV'si de belgenin
 *   `taxRate`'i üzerinden ayrı bir kalem olarak eklenir (src/lib/totals.ts):
 *   ₺100 + %20 → Ara Toplam ₺100, KDV ₺20, Genel Toplam ₺120.
 *
 * #311'in "Tutarlar KDV dahil" kipi bu sözleşmeyle birlikte KALDIRILDI: yazılan
 * tutarı sessizce net'e bölüp ekranda brüte geri çeviren çevrim, ₺100 yazan
 * kullanıcıya ₺83,33 gösteriyordu (BAK-75'in açılış şikâyeti).
 */

import { applyTaxBps } from "@/lib/money"

/** İşçilik/parça için Türkiye'de standart KDV oranı (bps). */
export const STANDARD_TAX_BPS = 2000

/**
 * Satır KDV'sini hesaplarken kullanılacak oran: belgenin KDV oranı tanımlıysa o,
 * değilse standart %20.
 *
 * Belgede oran yokken bir satırın tick'i açılırsa düzenleyici standart oranı
 * belgeye de YAZAR (bkz. PartsLaborEditor / onApplyStandardTax) — aksi hâlde
 * satırda "+₺20,00 KDV" yazarken Genel Toplam'a hiç KDV girmezdi.
 */
export function effectiveTaxBps(documentTaxBps: number | null | undefined): number {
  const bps = Math.trunc(documentTaxBps ?? 0)
  return bps > 0 ? bps : STANDARD_TAX_BPS
}

/**
 * Bir satırın net tutarına düşen KDV (kuruş) — YALNIZ GÖSTERİM içindir.
 *
 * Belgenin KDV'si tek noktada, `totals.ts` içinde, tabi satırların TOPLAM
 * matrahına bir kez uygulanır. Satır satır hesaplanan bu tutarların toplamı,
 * yuvarlama nedeniyle belge KDV'sinden en fazla birkaç kuruş sapabilir; bu
 * yüzden hiçbir toplam bu fonksiyondan beslenmez.
 */
export function lineVatKurus(netKurus: number | null, taxBps: number): number | null {
  if (netKurus == null) return null
  return applyTaxBps(netKurus, taxBps)
}
