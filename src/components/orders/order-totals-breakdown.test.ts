import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { calculateOrderTotals } from "@/lib/totals"

const DETAIL = readFileSync(join(import.meta.dir, "work-order-detail.tsx"), "utf8")
const PANEL = readFileSync(join(import.meta.dir, "order-management-panel.tsx"), "utf8")
const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
const TOTALS = readFileSync(join(import.meta.dir, "../../lib/totals.ts"), "utf8")

/**
 * BAK-55 — "Genel Toplam kalemle tutmuyor".
 *
 * Genel Toplam, kalem tutarlarının toplamı DEĞİLDİR: indirim düşülür, belgenin
 * `taxRate`'i eklenir (src/lib/totals.ts). Ekranda yalnız sonuç görününce
 * (₺400'lük tek kalemin üstünde ₺240) rakam hatalı okunuyordu. Bu yüzden
 * indirim/KDV varken zincirin ekranda görünmesi bir sözleşmedir.
 */

test("₺400 kalem + ₺200 indirim + %20 KDV → Genel Toplam ₺240 (ekrandaki zincirin aritmetiği)", () => {
  const totals = calculateOrderTotals(
    [{ type: "part", name: "Turbo radyatörü", quantity: 2, unitPrice: 20000, totalPrice: null }],
    { discountAmount: 20000, taxRate: 2000 },
  )
  expect(totals.subtotal).toBe(40000)
  expect(totals.discountAmount).toBe(20000)
  expect(totals.taxAmount).toBe(4000)
  expect(totals.grandTotal).toBe(24000)
  // Zincir kapanır: ara toplam − indirim + KDV = genel toplam.
  expect(totals.subtotal - totals.discountAmount + totals.taxAmount).toBe(totals.grandTotal)
})

test("indirim/KDV yokken Genel Toplam kalem toplamına eşittir", () => {
  const totals = calculateOrderTotals(
    [{ type: "part", name: "Turbo radyatörü", quantity: 2, unitPrice: 20000, totalPrice: null }],
    {},
  )
  expect(totals.grandTotal).toBe(totals.subtotal)
})

test("üst özet şeridi indirim/KDV varken ara toplam ve KDV satırlarını gösterir", () => {
  expect(DETAIL).toContain("Ara Toplam:")
  expect(DETAIL).toContain("İndirim:")
  expect(DETAIL).toContain("totals.discountAmount > 0 || order.totals.taxAmount > 0")
})

test("Fiyatlandırma kartında kalem toplamlarının altındaki satır Ara Toplam'dır", () => {
  expect(PANEL).toContain('label="Ara Toplam"')
  // Kalem toplamlarının hemen ardından Genel Toplam GELMEZ; araya ara toplam
  // (ve varsa indirim/KDV) girer.
  const afterExternalLabor = PANEL.slice(PANEL.indexOf('label="Dış İşçilik Toplamı"'))
  expect(afterExternalLabor.indexOf('label="Ara Toplam"')).toBeLessThan(
    afterExternalLabor.indexOf('label="Genel Toplam"'),
  )
})

test("satır KDV bayrağı hem gösterimi hem hesabı besler — ikisi ayrışamaz", () => {
  // BAK-55'in kuralı: satırda gösterilen tutarın Genel Toplam'da karşılığı
  // olmalı. #354 satır başına `includeVat`'ı, YALNIZ gösterimi değiştirip hiçbir
  // toplama girmediği için kaldırmıştı. BAK-53 onu geri getirdi; bu kez bayrak
  // `totals.ts`'in KDV matrahını da belirliyor. Bu test o bağı korur: satır
  // bayrağı gösterimde kullanılıyorsa, hesapta da kullanılmak ZORUNDA.
  expect(GRID).toContain("rowPriceMode")
  expect(GRID).toContain('fd.set("includeVat"')
  expect(GRID).toContain("toDisplayPriceKurusOrNull(row.unitPrice, rowPriceMode, taxBps)")

  // Hesap tarafı: matrah yalnız tabi satırlardan kuruluyor mu?
  expect(TOTALS).toContain("isVatLiable")
  expect(TOTALS).toContain("taxableSubtotal")
  // KDV, indirim sonrası TÜM ara toplama değil, tabi kısma uygulanır.
  expect(TOTALS).not.toContain("applyTaxBps(afterDiscount")
})
