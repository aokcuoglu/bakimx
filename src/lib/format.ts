/**
 * Currency and number formatting utilities.
 * Monetary values are integer KURUŞ (minor units); 1 TRY = 100 kuruş.
 */

import { formatKurus } from "@/lib/money"

const NUMBER_FORMATTER = new Intl.NumberFormat("tr-TR")

/**
 * Format an integer KURUŞ amount as a TRY currency string
 * (e.g. 125050 -> "₺1.250,50"). Delegates to the money module so there is a
 * single formatter/contract across the app.
 */
export function formatTRY(kurus: number): string {
  return formatKurus(kurus)
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
 * Format a phone number for display as the user types, to the standard Turkish
 * format "0544 515 74 08" (national leading 0 + 4-3-2-2 grouping).
 *
 * - Strips non-digits and any pasted +90 / 90 country code.
 * - Enforces the leading "0" so every screen shows the same standard.
 * - Caps at 11 digits (0 + 10), so input can't grow unbounded.
 *
 * The returned value (digits + spaces) is still accepted by {@link normalizePhone},
 * which the server uses to store the canonical 10-digit form.
 */
export function formatPhoneTR(input: string): string {
  let digits = input.replace(/\D/g, "")
  if (digits.startsWith("90") && digits.length > 10) {
    digits = digits.slice(2)
  }
  if (digits.length > 0 && !digits.startsWith("0")) {
    digits = "0" + digits
  }
  digits = digits.slice(0, 11)
  if (digits.length === 0) return ""
  const groups = [digits.slice(0, 4)]
  if (digits.length > 4) groups.push(digits.slice(4, 7))
  if (digits.length > 7) groups.push(digits.slice(7, 9))
  if (digits.length > 9) groups.push(digits.slice(9, 11))
  return groups.join(" ")
}

/**
 * Uppercase using the Turkish locale so i→İ and ı→I map correctly (a plain
 * toUpperCase / CSS text-transform would produce i→I). Used for name fields so
 * the stored value — not just the rendered text — is uppercased.
 */
export function toTrUpper(input: string): string {
  return input.toLocaleUpperCase("tr-TR")
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
