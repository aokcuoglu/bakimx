import { describe, expect, it, test } from "bun:test"
import { calculateOrderTotals, calculateOrderTotalsFromMinimal, formatOrderSummary, formatTaxRate } from "@/lib/totals"

// Money is integer kuruş; taxRate is bps (2000 = %20).

test("grandTotal computes tax exactly from kuruş line items", () => {
  const totals = calculateOrderTotals(
    [{ type: "labor", name: "x", quantity: 3, unitPrice: 3333, totalPrice: null }],
    { taxRate: 2000 }
  )
  expect(totals.subtotal).toBe(9999) // ₺99,99
  expect(totals.taxAmount).toBe(2000) // ₺20,00
  expect(totals.grandTotal).toBe(11999) // ₺119,99
})

test("discount is applied before tax", () => {
  const totals = calculateOrderTotals(
    [{ type: "part", name: "p", quantity: 1, unitPrice: null, totalPrice: 10000 }],
    { discountAmount: 1000, taxRate: 2000 }
  )
  expect(totals.subtotal).toBe(10000) // ₺100,00
  expect(totals.discountAmount).toBe(1000) // ₺10,00
  expect(totals.taxAmount).toBe(1800) // %20 of ₺90,00 = ₺18,00
  expect(totals.grandTotal).toBe(10800) // ₺108,00
})

test("parts and labor are grouped", () => {
  const totals = calculateOrderTotals([
    { type: "part", name: "p", quantity: 2, unitPrice: 5000, totalPrice: null },
    { type: "labor", name: "l", quantity: 1, unitPrice: null, totalPrice: 7500 },
  ])
  expect(totals.partsTotal).toBe(10000) // 2 * ₺50,00
  expect(totals.laborTotal).toBe(7500) // ₺75,00
  expect(totals.subtotal).toBe(17500)
  expect(totals.grandTotal).toBe(17500) // no tax/discount
})

test("external_labor satırı subtotal ve grandTotal'a dahil edilir", () => {
  const items = [
    { type: "part", name: "Yağ filtresi", quantity: 1, unitPrice: 6000, totalPrice: null },
    { type: "labor", name: "Yağ değişimi", quantity: 1, unitPrice: 10000, totalPrice: null },
    { type: "external_labor", name: "Rektifiye", quantity: 1, unitPrice: 50000, totalPrice: null },
  ]
  const t = calculateOrderTotals(items)
  expect(t.partsTotal).toBe(6000)
  expect(t.laborTotal).toBe(10000)
  expect(t.externalLaborTotal).toBe(50000)
  expect(t.externalLaborCount).toBe(1)
  expect(t.subtotal).toBe(66000)
  expect(t.grandTotal).toBe(66000)
})

test("formatOrderSummary dış işçilik toplamını biçimler, yoksa —", () => {
  const withExt = formatOrderSummary([{ type: "external_labor", name: "X", quantity: 1, unitPrice: 50000, totalPrice: null }])
  expect(withExt.externalLaborTotal).not.toBe("—")
  const without = formatOrderSummary([{ type: "part", name: "Y", quantity: 1, unitPrice: 6000, totalPrice: null }])
  expect(without.externalLaborTotal).toBe("—")
})

/**
 * Kırılım bayrakları — müşteri belgesi (Araç Kabul ve İşlem Özeti) İndirim ve
 * KDV satırlarını bunlara bakarak basar.
 */
describe("formatOrderSummary kırılım bayrakları", () => {
  const akü = (includeVat?: boolean) => ({
    type: "part", name: "Akü", quantity: 4, unitPrice: 10000, totalPrice: null, includeVat,
  })

  test("KDV oranı ve tabi kalem varsa hasTax açılır", () => {
    const s = formatOrderSummary([akü(true)], { taxRate: 2000 })
    expect(s.hasTax).toBe(true)
    expect(s.taxRate).toBe(2000)
    expect(s.taxAmount).toBe("₺80,00")
    expect(s.grandTotal).toBe("₺480,00")
  })

  test("oran tanımlı ama tabi kalem yoksa hasTax kapalı — '₺0,00 KDV' basılmaz", () => {
    const s = formatOrderSummary([akü(false)], { taxRate: 2000 })
    expect(s.hasTax).toBe(false)
    expect(s.grandTotal).toBe("₺400,00")
  })

  test("indirim yalnız sıfırdan büyükken satır ister", () => {
    expect(formatOrderSummary([akü(true)], { discountAmount: 0 }).hasDiscount).toBe(false)
    expect(formatOrderSummary([akü(true)], { discountAmount: 5000 }).hasDiscount).toBe(true)
  })
})

test("formatTaxRate bps'i yüzdeye çevirir, kesirli oranı virgülle yazar", () => {
  expect(formatTaxRate(2000)).toBe("%20")
  expect(formatTaxRate(1000)).toBe("%10")
  expect(formatTaxRate(0)).toBe("%0")
  expect(formatTaxRate(2050)).toBe("%20,50")
})

/**
 * Satır bazlı KDV (BAK-53). Sözleşme: `includeVat: false` olan satır belgenin
 * KDV'sini ALMAZ; alan yoksa satır tabidir.
 *
 * Bu blok aynı zamanda BAK-55'in regresyon kapısı: satırın ekranda gösterdiği
 * tutarın Genel Toplam'da karşılığı olmalı. #354 satır KDV'sini tam da bu
 * bağlantı kurulmadığı için kaldırmıştı.
 */
describe("satır bazlı KDV", () => {
  const part = (totalPrice: number, includeVat?: boolean) => ({
    type: "part",
    name: "Parça",
    quantity: 1,
    unitPrice: null,
    totalPrice,
    ...(includeVat === undefined ? {} : { includeVat }),
  })

  it("alan hiç yokken bugünkü davranış birebir korunur", () => {
    const withField = calculateOrderTotals([part(40_000, true)], { taxRate: 2000 })
    const withoutField = calculateOrderTotals([part(40_000)], { taxRate: 2000 })
    expect(withoutField.taxAmount).toBe(withField.taxAmount)
    expect(withoutField.grandTotal).toBe(withField.grandTotal)
    expect(withoutField.grandTotal).toBe(48_000)
  })

  it("includeVat=false satır KDV almaz", () => {
    const t = calculateOrderTotals([part(40_000, false)], { taxRate: 2000 })
    expect(t.subtotal).toBe(40_000)
    expect(t.taxableSubtotal).toBe(0)
    expect(t.taxAmount).toBe(0)
    expect(t.grandTotal).toBe(40_000)
  })

  it("karışık belgede KDV yalnız tabi satırlardan hesaplanır", () => {
    const t = calculateOrderTotals([part(40_000, true), part(10_000, false)], { taxRate: 2000 })
    expect(t.subtotal).toBe(50_000)
    expect(t.taxableSubtotal).toBe(40_000)
    expect(t.taxAmount).toBe(8_000) // yalnız 400,00 üzerinden
    expect(t.grandTotal).toBe(58_000)
  })

  it("belge indirimi tabi kısma ORANTILI dağıtılır", () => {
    // 400 tabi + 100 muaf = 500 ara toplam, 100 indirim.
    // Tabi payı: 100 × 400/500 = 80 → matrah 320 → KDV 64.
    const t = calculateOrderTotals([part(40_000, true), part(10_000, false)], {
      taxRate: 2000,
      discountAmount: 10_000,
    })
    expect(t.subtotal).toBe(50_000)
    expect(t.taxAmount).toBe(6_400)
    expect(t.grandTotal).toBe(46_400) // (500 − 100) + 64
  })

  it("hepsi tabiyken indirimli hesap da eski formülle aynı kalır", () => {
    const items = [part(20_000, true), part(20_000, true)]
    const t = calculateOrderTotals(items, { taxRate: 2000, discountAmount: 20_000 })
    // BAK-55'teki ekran görüntüsünün senaryosu: 400 − 200 + %20 = 240.
    expect(t.grandTotal).toBe(24_000)
    expect(t.taxAmount).toBe(4_000)
  })

  it("tüm satırlar muafken indirim KDV üretmez", () => {
    const t = calculateOrderTotals([part(40_000, false)], { taxRate: 2000, discountAmount: 10_000 })
    expect(t.taxAmount).toBe(0)
    expect(t.grandTotal).toBe(30_000)
  })

  it("calculateOrderTotalsFromMinimal aynı sözleşmeyi uygular", () => {
    const minimal = (totalPrice: number, includeVat?: boolean) => ({
      totalPrice,
      unitPrice: null,
      quantity: 1,
      ...(includeVat === undefined ? {} : { includeVat }),
    })
    expect(
      calculateOrderTotalsFromMinimal([minimal(40_000, false)], { taxRate: 2000 }).grandTotal,
    ).toBe(40_000)
    expect(
      calculateOrderTotalsFromMinimal([minimal(40_000)], { taxRate: 2000 }).grandTotal,
    ).toBe(48_000)
  })
})
