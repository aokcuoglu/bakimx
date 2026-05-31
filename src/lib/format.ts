/**
 * Currency and number formatting utilities.
 * All monetary values use TRY (Turkish Lira).
 */

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_FORMATTER = new Intl.NumberFormat("tr-TR")

/**
 * Format a number as TRY currency string (e.g. "₺1.250,50").
 */
export function formatTRY(amount: number): string {
  return TRY_FORMATTER.format(amount)
}

/**
 * Format an integer with Turkish locale separators (e.g. "125.000").
 */
export function formatNumber(num: number): string {
  return NUMBER_FORMATTER.format(num)
}

/**
 * Format a mileage value with "km" suffix.
 */
export function formatMileage(km: number): string {
  return `${formatNumber(km)} km`
}

/**
 * Normalize a phone number input to a standard Turkish mobile format.
 * Strips non-digit characters, handles leading 0/90.
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "")
  if (digits.startsWith("90") && digits.length > 10) {
    digits = digits.slice(2)
  }
  if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1)
  }
  return digits
}

/**
 * Normalize a Turkish plate number: uppercase, remove spaces.
 */
export function normalizePlate(input: string): string {
  return input.replace(/\s/g, "").toUpperCase()
}
