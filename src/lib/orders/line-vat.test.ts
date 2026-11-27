import { describe, expect, test } from "bun:test"
import { STANDARD_TAX_BPS, effectiveTaxBps, lineVatKurus, rowTaxBps } from "@/lib/orders/line-vat"

describe("effectiveTaxBps", () => {
  test("belgenin oranı varsa o kullanılır", () => {
    expect(effectiveTaxBps(1000)).toBe(1000)
    expect(effectiveTaxBps(2000)).toBe(2000)
  })

  test("oran yok / sıfır / geçersizse standart %20", () => {
    expect(effectiveTaxBps(null)).toBe(STANDARD_TAX_BPS)
    expect(effectiveTaxBps(undefined)).toBe(STANDARD_TAX_BPS)
    expect(effectiveTaxBps(0)).toBe(STANDARD_TAX_BPS)
    expect(effectiveTaxBps(-500)).toBe(STANDARD_TAX_BPS)
  })
})

describe("lineVatKurus", () => {
  test("net tutarın ÜSTÜNE binen KDV döner — net'i bölmez", () => {
    // BAK-75'in tam senaryosu: ₺100 girildi, üstüne ₺20 biner, toplam ₺120.
    expect(lineVatKurus(10000, 2000)).toBe(2000)
  })

  test("fiyat girilmemiş satırda KDV de yoktur", () => {
    expect(lineVatKurus(null, 2000)).toBeNull()
  })

  test("kuruşlu tutarda yuvarlama money.ts politikasını izler", () => {
    // ₺99,99 @ %20 = ₺19,998 → ₺20,00 (yarımlar sıfırdan uzağa).
    expect(lineVatKurus(9999, 2000)).toBe(2000)
    expect(lineVatKurus(0, 2000)).toBe(0)
  })
})

describe("rowTaxBps (#1007)", () => {
  test("belgenin oranı varsa o; tick'in yazacağı oran önemsiz", () => {
    expect(rowTaxBps(1000, false)).toBe(1000)
    expect(rowTaxBps(2000, true)).toBe(2000)
  })

  test("oran yoksa 0 — totals.ts `taxRate ?? 0` ile aynı", () => {
    expect(rowTaxBps(null, false)).toBe(0)
    expect(rowTaxBps(undefined, false)).toBe(0)
    expect(rowTaxBps(0, false)).toBe(0)
    expect(rowTaxBps(-500, false)).toBe(0)
  })

  test("oran yok ama tick belgeye %20 yazacaksa önizleme %20", () => {
    expect(rowTaxBps(null, true)).toBe(STANDARD_TAX_BPS)
    expect(rowTaxBps(0, true)).toBe(STANDARD_TAX_BPS)
  })

  test("1×₺500 tabi satır: oran yoksa KDV 0 / brüt 50000; oran 2000 ise brüt 60000", () => {
    const gross = (rate: number | null) => 50_000 + (lineVatKurus(50_000, rowTaxBps(rate, false)) ?? 0)
    expect(gross(null)).toBe(50_000)
    expect(gross(2000)).toBe(60_000)
  })
})
