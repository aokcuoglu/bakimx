/**
 * Money module — BakımX.
 *
 * CONTRACT
 * --------
 * - Money is an **integer number of kuruş** (minor units). 1 TRY = 100 kuruş.
 *   A `number` that represents money in this codebase is always kuruş, never lira.
 * - Rates (tax, discount) are **integer basis points (bps)**. 100% = 10000 bps,
 *   %20 = 2000 bps, %5,5 = 550 bps.
 * - All rounding happens **here, once**, with a single policy: round half away
 *   from zero. Addition/subtraction of kuruş is exact (integers) and never rounds;
 *   only rate/share computations round.
 *
 * The lira<->kuruş boundary (user input, display) is crossed with
 * `parseTRYToKurus` / `liraToKurus` (in) and `kurusToLira` / `formatKurus` (out).
 */

// ---------------------------------------------------------------------------
// Rounding policy (single source of truth)
// ---------------------------------------------------------------------------

/** Round to the nearest integer, ties away from zero. Non-finite -> 0. */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * Compute round(amount * mul / div) using integer remainder arithmetic so there
 * is no binary-float drift at the half boundary. `amount`, `mul`, `div` are
 * treated as integers; ties round away from zero.
 */
export function mulDivRound(amount: number, mul: number, div: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(mul) || !div) return 0
  const numerator = Math.trunc(amount) * Math.trunc(mul)
  const d = Math.trunc(div)
  const q = Math.trunc(numerator / d)
  const r = numerator % d
  // |r|*2 >= |d|  ->  bump one step in the sign of the numerator.
  if (Math.abs(r) * 2 >= Math.abs(d)) {
    return q + (numerator < 0 ? -1 : 1)
  }
  return q
}

// ---------------------------------------------------------------------------
// lira <-> kuruş boundary
// ---------------------------------------------------------------------------

/**
 * Convert a lira amount (possibly fractional, e.g. 33.33) to integer kuruş.
 * Uses fixed-point string rounding to avoid binary-float artefacts at the
 * half-kuruş boundary (e.g. 1.005 -> 101, ties away from zero).
 */
export function liraToKurus(lira: number): number {
  if (!Number.isFinite(lira)) return 0
  return roundHalfAwayFromZero(parseFloat((lira * 100).toFixed(4)))
}

/** Convert integer kuruş to a lira number (for display/formatting only). */
export function kurusToLira(kurus: number): number {
  if (!Number.isFinite(kurus)) return 0
  return Math.trunc(kurus) / 100
}

/**
 * Parse a user-entered TRY string into integer kuruş. Handles Turkish
 * ("1.234,56") and plain ("1234.56", "33,33", "₺99,99") formats. Returns null
 * for empty/invalid input so callers can distinguish "no value" from zero.
 */
export function parseTRYToKurus(input: string): number | null {
  if (typeof input !== "string") return null
  const s = input.trim().replace(/[₺\s]/g, "").replace(/TL/gi, "")
  if (!s) return null

  const hasComma = s.includes(",")
  const hasDot = s.includes(".")
  let normalized: string
  if (hasComma && hasDot) {
    // The right-most separator is the decimal separator.
    normalized =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "")
  } else if (hasComma) {
    // Comma is the decimal separator (Turkish).
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else {
    // Only dots (or none): treat as a plain/decimal number.
    normalized = s
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return liraToKurus(n)
}

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format an integer kuruş amount as a TRY string, e.g. 129900 -> "₺1.299,00". */
export function formatKurus(kurus: number): string {
  return TRY_FORMATTER.format(kurusToLira(kurus))
}

// ---------------------------------------------------------------------------
// kuruş arithmetic (exact; integers)
// ---------------------------------------------------------------------------

/** a + b in kuruş. */
export function addKurus(a: number, b: number): number {
  return Math.trunc(a) + Math.trunc(b)
}

/** a - b in kuruş. */
export function subKurus(a: number, b: number): number {
  return Math.trunc(a) - Math.trunc(b)
}

/** Sum a list of kuruş values. Non-finite entries are ignored. */
export function sumKurus(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (sum, v) => sum + (v != null && Number.isFinite(v) ? Math.trunc(v) : 0),
    0
  )
}

/** Apply a discount in kuruş, clamped so the result never goes below zero. */
export function applyDiscountKurus(amountKurus: number, discountKurus: number): number {
  return Math.max(0, subKurus(amountKurus, Math.max(0, Math.trunc(discountKurus))))
}

/**
 * Tax amount (kuruş) for a base amount at a given rate in bps.
 * applyTaxBps(9999, 2000) -> 2000 (₺99,99 @ %20 = ₺20,00).
 */
export function applyTaxBps(amountKurus: number, bps: number): number {
  return mulDivRound(amountKurus, Math.max(0, Math.trunc(bps)), 10000)
}

/** A share of an amount (kuruş) at a given rate in bps (e.g. customer discount). */
export function applyRateBps(amountKurus: number, bps: number): number {
  return mulDivRound(amountKurus, Math.max(0, Math.trunc(bps)), 10000)
}

// ---------------------------------------------------------------------------
// bps helpers
// ---------------------------------------------------------------------------

/** Percent (e.g. 20, 5.5) -> bps (2000, 550). */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return roundHalfAwayFromZero(parseFloat((percent * 100).toFixed(4)))
}

/** bps (2000) -> percent number (20). For display. */
export function bpsToPercent(bps: number): number {
  if (!Number.isFinite(bps)) return 0
  return Math.trunc(bps) / 100
}

// ---------------------------------------------------------------------------
// DEPRECATED float helpers — kept until all callers migrate to the kuruş API
// (see migration phases). These operate on lira floats and must not be used in
// new code. Removal is scheduled once totals.ts / cashbox / customer-totals and
// the display layer no longer reference them.
// ---------------------------------------------------------------------------

/** @deprecated float (lira) era — half a kuruş tolerance. Use exact kuruş. */
export const MONEY_EPSILON = 0.005

/** @deprecated Round a lira float to 2 decimals. Use kuruş integers + {@link roundHalfAwayFromZero}. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** @deprecated Sum lira floats. Use {@link sumKurus}. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0))
}

/** @deprecated Use {@link addKurus}. */
export function addMoney(a: number, b: number): number {
  return roundMoney(a + b)
}

/** @deprecated Use {@link subKurus}. */
export function subMoney(a: number, b: number): number {
  return roundMoney(a - b)
}

/** @deprecated Kuruş integers compare exactly; no epsilon needed. */
export function moneyEquals(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return Math.abs(a - b) < epsilon
}

/** @deprecated Kuruş integers compare exactly; use `>=`. */
export function moneyGte(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return a >= b - epsilon
}
