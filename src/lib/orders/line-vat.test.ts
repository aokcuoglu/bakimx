import { describe, expect, test } from "bun:test"
import { STANDARD_TAX_BPS, effectiveTaxBps, lineVatKurus } from "@/lib/orders/line-vat"

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
