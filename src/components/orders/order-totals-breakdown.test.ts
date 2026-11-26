import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { calculateOrderTotals } from "@/lib/totals"

const DETAIL = readFileSync(join(import.meta.dir, "work-order-detail.tsx"), "utf8")
const PANEL = readFileSync(join(import.meta.dir, "order-management-panel.tsx"), "utf8")
const SUMMARY = readFileSync(join(import.meta.dir, "order-status-summary.tsx"), "utf8")
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

/**
 * #912 — para tek yerde: zincir raydaki Ödeme kartında ve telefon özet kartında
 * görünür, ikisi de aynı saf fonksiyondan (`orderTotalsChain`) okur. Başlığın
 * altındaki tutar şeridi ve Kalemler'deki `MobileTotalsBar` geri gelmez.
 * Zincirin aritmetiği ve etiket sırası `src/lib/orders/totals-chain.test.ts`'te.
 */
test("Ödeme kartı ve telefon özeti zinciri orderTotalsChain'den okur; şerit ve MobileTotalsBar yok", () => {
  expect(PANEL).toContain("const chain = orderTotalsChain(totals, taxRateBps)")
  expect(DETAIL).toContain("chainText: totalsChainText(orderTotalsChain(order.totals, order.taxRate))")
  expect(DETAIL).toContain("taxRateBps={order.taxRate}")
  expect(SUMMARY).toContain("money.chainText")
  expect(DETAIL).not.toContain("MobileTotalsBar")
  expect(DETAIL).not.toContain("Genel Toplam:")
  expect(DETAIL).not.toContain("Ara Toplam:")
  // KDV oranı türetilmez: kısmi KDV'li belgede yanlış oran yazıyordu.
  expect(PANEL).not.toContain("orderTaxRateDisplay")
})

test("Ödeme kartında zincir Genel Toplam'dan önce ve açılır satırın DIŞINDA", () => {
  const card = PANEL.slice(PANEL.indexOf("export function OrderPaymentCard"), PANEL.indexOf("<Dialog open={editingMeta}"))
  const chainAt = card.indexOf("{chain.map(")
  expect(chainAt).toBeGreaterThan(0)
  expect(chainAt).toBeLessThan(card.indexOf('label="Genel Toplam"'))
  // Zincir katlanmaz; yalnız kalem türü dökümü açılır satırdadır.
  const disclosure = card.slice(card.indexOf("<AccordionContent>"), card.indexOf("</AccordionContent>"))
  expect(card.indexOf("<AccordionContent>")).toBeGreaterThan(chainAt)
  expect(disclosure).not.toContain("chain")
  expect(disclosure).not.toContain('label="Genel Toplam"')
  expect(disclosure).toContain('label="Dış İşçilik Toplamı"')
  // Accordion Radix API'si: tek açılır, kapanabilir, öğe değeri zorunlu.
  expect(card).toContain('<Accordion type="single" collapsible>')
  expect(card).toMatch(/<AccordionItem value="[^"]+">/)
})

test("satır KDV bayrağı hem gösterimi hem hesabı besler — ikisi ayrışamaz", () => {
  // BAK-55'in kuralı: satırda gösterilen tutarın Genel Toplam'da karşılığı
  // olmalı. #354 satır başına `includeVat`'ı, YALNIZ gösterimi değiştirip hiçbir
  // toplama girmediği için kaldırmıştı. BAK-53 onu geri getirdi; bu kez bayrak
  // `totals.ts`'in KDV matrahını da belirliyor. Bu test o bağı korur: satır
  // bayrağı gösterimde kullanılıyorsa, hesapta da kullanılmak ZORUNDA.
  expect(GRID).toContain("const vatLiable = row.includeVat !== false")
  expect(GRID).toContain("const vatKurus = vatLiable ? lineVatKurus(lineTotal, taxBps) : null")
  expect(GRID).toContain('fd.set("includeVat"')

  // Hesap tarafı: matrah yalnız tabi satırlardan kuruluyor mu?
  expect(TOTALS).toContain("isVatLiable")
  expect(TOTALS).toContain("taxableSubtotal")
  // KDV, indirim sonrası TÜM ara toplama değil, tabi kısma uygulanır.
  expect(TOTALS).not.toContain("applyTaxBps(afterDiscount")
})

test("BAK-75 — ₺100 kalem: tick kapalıyken ₺100, açıkken ₺120", () => {
  const line = { type: "part", name: "Turbo radyatörü", quantity: 1, unitPrice: 10000, totalPrice: null }

  // Varsayılan (tick kapalı): KDV oranı belgede tanımlı olsa bile satır matraha
  // girmez — Genel Toplam yazılan tutarın ta kendisidir.
  const withoutVat = calculateOrderTotals([{ ...line, includeVat: false }], { taxRate: 2000 })
  expect(withoutVat.subtotal).toBe(10000)
  expect(withoutVat.taxAmount).toBe(0)
  expect(withoutVat.grandTotal).toBe(10000)

  // Tick açık: tutar DEĞİŞMEZ, üstüne %20 biner ve kırılım ayrı okunur.
  const withVat = calculateOrderTotals([{ ...line, includeVat: true }], { taxRate: 2000 })
  expect(withVat.subtotal).toBe(10000)
  expect(withVat.taxAmount).toBe(2000)
  expect(withVat.grandTotal).toBe(12000)
})
