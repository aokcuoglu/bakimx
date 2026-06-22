/**
 * Money helpers for BakımX.
 *
 * Money is stored as Float (Postgres double precision). These helpers contain
 * the float drift at calculation and comparison boundaries: round to 2 decimals
 * (Turkish Lira / kuruş) and compare with a half-kuruş epsilon. They do NOT
 * change the database type — that (Decimal) is a separate, later migration.
 */

/** Half a kuruş — the tolerance for money comparisons. */
export const MONEY_EPSILON = 0.005

/** Round to 2 decimals (half-up), guarding against binary float error. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sum a list and round once at the end. Non-finite entries are ignored. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0))
}

/** Rounded a + b. */
export function addMoney(a: number, b: number): number {
  return roundMoney(a + b)
}

/** Rounded a - b. */
export function subMoney(a: number, b: number): number {
  return roundMoney(a - b)
}

/** True when a and b are equal within epsilon. */
export function moneyEquals(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return Math.abs(a - b) < epsilon
}

/** True when a >= b within epsilon (a is at least b, allowing sub-cent drift). */
export function moneyGte(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return a >= b - epsilon
}
