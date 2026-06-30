import { expect, test } from "bun:test"
import {
  roundHalfAwayFromZero,
  mulDivRound,
  liraToKurus,
  kurusToLira,
  parseTRYToKurus,
  formatKurus,
  addKurus,
  subKurus,
  sumKurus,
  applyDiscountKurus,
  applyTaxBps,
  applyRateBps,
  percentToBps,
  bpsToPercent,
} from "@/lib/money"

// ---------------------------------------------------------------------------
// Rounding policy: half away from zero
// ---------------------------------------------------------------------------

test("roundHalfAwayFromZero rounds ties away from zero", () => {
  expect(roundHalfAwayFromZero(0.5)).toBe(1)
  expect(roundHalfAwayFromZero(1.5)).toBe(2)
  expect(roundHalfAwayFromZero(2.5)).toBe(3)
  expect(roundHalfAwayFromZero(-0.5)).toBe(-1)
  expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
  expect(roundHalfAwayFromZero(2.4)).toBe(2)
  expect(roundHalfAwayFromZero(Infinity)).toBe(0)
})

test("mulDivRound is exact at the half boundary (no float drift)", () => {
  // 9999 * 2000 / 10000 = 1999.8 -> 2000
  expect(mulDivRound(9999, 2000, 10000)).toBe(2000)
  // 5 * 2000 / 10000 = 1.0 -> 1
  expect(mulDivRound(5, 2000, 10000)).toBe(1)
  // 25 * 2000 / 10000 = 5.0 exact
  expect(mulDivRound(25, 2000, 10000)).toBe(5)
  // exact half: 50000 * 1 / 10000 = 5 ; tie test: 15000/10000 = 1.5 -> 2
  expect(mulDivRound(15000, 1, 10000)).toBe(2)
  expect(mulDivRound(-15000, 1, 10000)).toBe(-2)
})

// ---------------------------------------------------------------------------
// lira <-> kuruş boundary
// ---------------------------------------------------------------------------

test("liraToKurus avoids the classic 0.1 + 0.2 float trap", () => {
  expect(liraToKurus(0.1)).toBe(10)
  expect(liraToKurus(0.2)).toBe(20)
  expect(addKurus(liraToKurus(0.1), liraToKurus(0.2))).toBe(30) // ₺0,30
  expect(kurusToLira(addKurus(liraToKurus(0.1), liraToKurus(0.2)))).toBe(0.3)
})

test("liraToKurus rounds half-kuruş away from zero despite float input", () => {
  expect(liraToKurus(1.005)).toBe(101) // would be 100 with naive Math.round(1.005*100)
  expect(liraToKurus(2.675)).toBe(268)
  expect(liraToKurus(33.33)).toBe(3333)
  expect(liraToKurus(1250.5)).toBe(125050)
})

test("kurusToLira divides by 100", () => {
  expect(kurusToLira(125050)).toBe(1250.5)
  expect(kurusToLira(0)).toBe(0)
})

test("parseTRYToKurus handles Turkish and plain formats", () => {
  expect(parseTRYToKurus("1.234,56")).toBe(123456)
  expect(parseTRYToKurus("1234.56")).toBe(123456)
  expect(parseTRYToKurus("33,33")).toBe(3333)
  expect(parseTRYToKurus("33.33")).toBe(3333)
  expect(parseTRYToKurus("₺99,99")).toBe(9999)
  expect(parseTRYToKurus("1.000,50")).toBe(100050) // Turkish: dot thousands, comma decimal
  // A lone dot is the decimal separator (HTML number inputs emit this form),
  // so "1.000" is ₺1,00 = 100 kuruş, not one thousand lira.
  expect(parseTRYToKurus("1.000")).toBe(100)
  expect(parseTRYToKurus("0")).toBe(0)
  expect(parseTRYToKurus("")).toBeNull()
  expect(parseTRYToKurus("   ")).toBeNull()
  expect(parseTRYToKurus("abc")).toBeNull()
})

test("formatKurus renders TRY from kuruş", () => {
  expect(formatKurus(129900)).toContain("1.299,00")
  expect(formatKurus(9999)).toContain("99,99")
})

// ---------------------------------------------------------------------------
// kuruş arithmetic
// ---------------------------------------------------------------------------

test("addKurus/subKurus are exact integer operations", () => {
  expect(addKurus(10, 20)).toBe(30)
  expect(subKurus(30, 10)).toBe(20)
  expect(sumKurus([1001, 2002, 3003])).toBe(6006)
  expect(sumKurus([10, null, undefined, 20])).toBe(30)
  expect(sumKurus([])).toBe(0)
})

test("applyDiscountKurus clamps at zero", () => {
  expect(applyDiscountKurus(10000, 2500)).toBe(7500)
  expect(applyDiscountKurus(10000, 0)).toBe(10000)
  expect(applyDiscountKurus(10000, 15000)).toBe(0) // never negative
  expect(applyDiscountKurus(10000, -500)).toBe(10000) // negative discount ignored
})

// ---------------------------------------------------------------------------
// Tax (%20) on single / odd amounts
// ---------------------------------------------------------------------------

test("applyTaxBps computes %20 VAT exactly", () => {
  // ₺99,99 @ %20 = ₺20,00
  expect(applyTaxBps(9999, 2000)).toBe(2000)
  // ₺100,00 @ %20 = ₺20,00
  expect(applyTaxBps(10000, 2000)).toBe(2000)
  // ₺33,33 @ %20 = 666.6 -> ₺6,67 (rounds away from zero)
  expect(applyTaxBps(3333, 2000)).toBe(667)
  // %5,5 (550 bps) on ₺100,00 = ₺5,50
  expect(applyTaxBps(10000, 550)).toBe(550)
  // zero rate -> zero tax
  expect(applyTaxBps(12345, 0)).toBe(0)
})

test("discount-then-tax order matches the server policy", () => {
  // subtotal ₺99,99 ; discount ₺9,99 ; %20 KDV
  const subtotal = sumKurus([3333, 3333, 3333]) // ₺99,99
  expect(subtotal).toBe(9999)
  const afterDiscount = applyDiscountKurus(subtotal, 999)
  expect(afterDiscount).toBe(9000) // ₺90,00
  const tax = applyTaxBps(afterDiscount, 2000)
  expect(tax).toBe(1800) // ₺18,00
  const grandTotal = addKurus(afterDiscount, tax)
  expect(grandTotal).toBe(10800) // ₺108,00
})

test("multi-line rounding: sum of line totals then single tax round", () => {
  // 3 items @ ₺33,33 -> line totals exact, subtotal ₺99,99, tax ₺20,00, grand ₺119,99
  const lines = [3333, 3333, 3333]
  const subtotal = sumKurus(lines)
  const tax = applyTaxBps(subtotal, 2000)
  const grand = addKurus(subtotal, tax)
  expect(subtotal).toBe(9999)
  expect(tax).toBe(2000)
  expect(grand).toBe(11999)
})

test("partial payment leaves a correct remaining balance", () => {
  const grandTotal = 11999 // ₺119,99
  const paid = sumKurus([5000, 5000]) // ₺100,00
  const remaining = Math.max(0, subKurus(grandTotal, paid))
  expect(remaining).toBe(1999) // ₺19,99
  // overpayment clamps remaining at zero
  expect(Math.max(0, subKurus(grandTotal, 13000))).toBe(0)
})

test("applyRateBps applies a customer discount rate", () => {
  // %10 of ₺250,00 = ₺25,00
  expect(applyRateBps(25000, 1000)).toBe(2500)
  // %5,5 of ₺123,45 = 679.0... -> ₺6,79
  expect(applyRateBps(12345, 550)).toBe(679)
})

// ---------------------------------------------------------------------------
// bps helpers
// ---------------------------------------------------------------------------

test("percentToBps / bpsToPercent round-trip", () => {
  expect(percentToBps(20)).toBe(2000)
  expect(percentToBps(5.5)).toBe(550)
  expect(percentToBps(0)).toBe(0)
  expect(percentToBps(100)).toBe(10000)
  expect(bpsToPercent(2000)).toBe(20)
  expect(bpsToPercent(550)).toBe(5.5)
})
