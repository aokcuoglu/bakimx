/**
 * BakımX pricing discount calculator (BAK-47).
 *
 * Discount is applied via basis points (bps) stored in workshop.bakimxDiscountBps.
 * 0-10000 bps range: 2000 = 20%, 10000 = 100%.
 * Formula: discountedPrice = basePrice × (10000 - discountBps) / 10000
 */

/**
 * Multiply and divide with correct rounding.
 * Used for price calculations to avoid floating-point errors.
 * Result: floor((a × b) / c)
 */
function mulDivRound(a: number, b: number, c: number): number {
  return Math.floor((a * b) / c)
}

/**
 * Apply workshop discount to a base price (in kuruş).
 * Returns discounted price (in kuruş, integer).
 *
 * @param basePriceKurus - Base price in kuruş (must be integer)
 * @param discountBps - Discount in basis points (0-10000; 2000 = 20%)
 * @returns Discounted price in kuruş
 */
export function resolveWorkshopPrice(basePriceKurus: number, discountBps: number): number {
  if (discountBps === 0) return basePriceKurus
  // discountedPrice = basePrice × (10000 - discountBps) / 10000
  return mulDivRound(basePriceKurus, 10000 - discountBps, 10000)
}

/**
 * Format discount percentage label for display.
 * Returns empty string if discount is 0 (no discount applied).
 *
 * @param discountBps - Discount in basis points
 * @returns Formatted string like "%15 BakımX iskontosu uygulandı" or ""
 */
export function formatDiscountLabel(discountBps: number): string {
  if (discountBps === 0) return ""
  const percent = discountBps / 100
  return `%${percent} BakımX iskontosu uygulandı`
}

/**
 * Calculate discount amount for a given price.
 * Used for display/reporting purposes.
 *
 * @param basePriceKurus - Base price in kuruş
 * @param discountBps - Discount in basis points
 * @returns Discount amount in kuruş
 */
export function calculateDiscountAmount(basePriceKurus: number, discountBps: number): number {
  if (discountBps === 0) return 0
  return mulDivRound(basePriceKurus, discountBps, 10000)
}
