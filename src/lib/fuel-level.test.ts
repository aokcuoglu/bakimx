import { expect, test } from "bun:test"
import {
  FUEL_LEVELS,
  formatFuelLevel,
  isFuelLevel,
  isFuelSegmentFilled,
  isLowFuel,
} from "./fuel-level"

/**
 * #197: kadran + buton yığını tek sıra çubuğa indi. Çubuğun doluluğu
 * `isFuelSegmentFilled` ile hesaplanır ve buradaki asıl tuzak "E" = 0:
 * `value &&` kalıbı geçerli bir ölçümü boş çubuk gibi gösterir.
 */

test("seçili kademeye kadar tüm bölmeler dolar", () => {
  const filled = FUEL_LEVELS.map((l) => isFuelSegmentFilled(l, 50))
  expect(filled).toEqual([true, true, true, false, false])
})

test("E (0) geçerli ölçümdür — yalnız ilk bölme dolar, çubuk boş kalmaz", () => {
  const filled = FUEL_LEVELS.map((l) => isFuelSegmentFilled(l, 0))
  expect(filled).toEqual([true, false, false, false, false])
  expect(isFuelSegmentFilled(0, 0)).toBe(true)
})

test("ölçüm yoksa (null) hiçbir bölme dolmaz", () => {
  expect(FUEL_LEVELS.map((l) => isFuelSegmentFilled(l, null))).toEqual([
    false,
    false,
    false,
    false,
    false,
  ])
})

test("Full seçiliyken çubuk tamamen dolar", () => {
  expect(FUEL_LEVELS.every((l) => isFuelSegmentFilled(l, 100))).toBe(true)
})

test("düşük yakıt eşiği E ve 1/4'ü kapsar", () => {
  expect(isLowFuel(0)).toBe(true)
  expect(isLowFuel(25)).toBe(true)
  expect(isLowFuel(50)).toBe(false)
  expect(isLowFuel(100)).toBe(false)
})

test("kademe etiketleri kesir olarak gösterilir", () => {
  expect(FUEL_LEVELS.map(formatFuelLevel)).toEqual(["E", "1/4", "1/2", "3/4", "Full"])
})

test("kademe dışı değerler yüzde olarak gösterilir", () => {
  expect(formatFuelLevel(37)).toBe("%37")
  expect(isFuelLevel(37)).toBe(false)
  expect(isFuelLevel(75)).toBe(true)
})
