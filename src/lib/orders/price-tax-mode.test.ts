import { expect, test } from "bun:test"
import {
  STANDARD_TAX_BPS,
  effectiveTaxBps,
  isPriceTaxMode,
  readPriceTaxMode,
  resolvePriceTaxMode,
  toDisplayPriceKurus,
  toDisplayPriceKurusOrNull,
  toStoredPriceKurus,
} from "@/lib/orders/price-tax-mode"

test("effectiveTaxBps belgenin oranını kullanır, yoksa standart %20", () => {
  expect(effectiveTaxBps(1000)).toBe(1000)
  expect(effectiveTaxBps(2000)).toBe(2000)
  expect(effectiveTaxBps(0)).toBe(STANDARD_TAX_BPS)
  expect(effectiveTaxBps(null)).toBe(STANDARD_TAX_BPS)
  expect(effectiveTaxBps(undefined)).toBe(STANDARD_TAX_BPS)
})

test("KDV hariç kipi tutarı hiç değiştirmez (bugünkü davranış)", () => {
  expect(toStoredPriceKurus(350000, "excluded", 2000)).toBe(350000)
  expect(toDisplayPriceKurus(350000, "excluded", 2000)).toBe(350000)
})

test("KDV dahil kipinde yazılan tutar net'e çevrilip saklanır", () => {
  // ₺4.200 KDV dahil → ₺3.500 + KDV
  expect(toStoredPriceKurus(420000, "included", 2000)).toBe(350000)
  // ₺3.500 KDV dahil → ₺2.916,67 net
  expect(toStoredPriceKurus(350000, "included", 2000)).toBe(291667)
})

test("KDV dahil kipinde saklanan net tutar KDV'li gösterilir", () => {
  expect(toDisplayPriceKurus(350000, "included", 2000)).toBe(420000)
  expect(toDisplayPriceKurus(291667, "included", 2000)).toBe(350000)
  // Standart dışı oran da desteklenir (%10)
  expect(toDisplayPriceKurus(100000, "included", 1000)).toBe(110000)
})

test("tam lira ve 10 kuruşluk tutarlarda gidiş-dönüş birebir kapanır (%20)", () => {
  for (let gross = 0; gross <= 2_000_00; gross += 10) {
    const stored = toStoredPriceKurus(gross, "included", 2000)
    expect(toDisplayPriceKurus(stored, "included", 2000)).toBe(gross)
  }
})

test("fiyat girilmemiş kalem null kalır", () => {
  expect(toDisplayPriceKurusOrNull(null, "included", 2000)).toBeNull()
  expect(toDisplayPriceKurusOrNull(350000, "included", 2000)).toBe(420000)
})

test("isPriceTaxMode yalnız bilinen kipleri kabul eder", () => {
  expect(isPriceTaxMode("included")).toBe(true)
  expect(isPriceTaxMode("excluded")).toBe(true)
  expect(isPriceTaxMode("dahil")).toBe(false)
  expect(isPriceTaxMode(null)).toBe(false)
})

test("yeni kullanıcıda KDV dahil kip varsayılandır", () => {
  expect(resolvePriceTaxMode(null)).toBe("included")
  expect(resolvePriceTaxMode("bozuk")).toBe("included")
  expect(readPriceTaxMode()).toBe("included")
})

test("kullanıcının geçerli KDV tercihi korunur", () => {
  expect(resolvePriceTaxMode("excluded")).toBe("excluded")
  expect(resolvePriceTaxMode("included")).toBe("included")
})
