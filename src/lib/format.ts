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
 * Normalize a Turkish plate number: strip non-alphanumeric, uppercase, compact form (e.g. "34ABC123").
 */
export function normalizePlate(input: string): string {
  return input.replace(/[^0-9A-Za-zğüşıöçĞÜŞİÖÇ]/g, "").toUpperCase()
}

/**
 * Build a displayable name for a customer. Handles corporate/individual and null fields.
 */
export function customerDisplayName(customer: {
  type?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  companyName?: string | null
  contactName?: string | null
}): string {
  if (customer.type === "corporate") {
    return customer.companyName || customer.contactName || "Kurumsal Müşteri"
  }
  const full = (customer.fullName || "").trim()
  if (full) return full
  const first = (customer.firstName || "").trim()
  const last = (customer.lastName || "").trim()
  return [first, last].filter(Boolean).join(" ") || "Müşteri"
}
