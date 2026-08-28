export const SUBSCRIPTION_VAT_RATE_BPS = 2000

export type BillingTaxSnapshot = {
  vatRateBps: number
  grossAmountMinor: number
  netAmountMinor: number
}

/**
 * KDV dahil tahsilatı tam sayı kuruşla brüt/net snapshot'a ayırır.
 * Pozitif tutarlarda Math.round, PostgreSQL migration'ındaki numeric ROUND ile
 * aynı yarım-yukarı davranışı verir.
 */
export function createBillingTaxSnapshot(
  grossAmountMinor: number,
  vatRateBps: number = SUBSCRIPTION_VAT_RATE_BPS,
): BillingTaxSnapshot {
  if (!Number.isSafeInteger(grossAmountMinor) || grossAmountMinor < 0) {
    throw new Error("Brüt sipariş tutarı negatif olmayan tam sayı kuruş olmalıdır.")
  }
  if (!Number.isSafeInteger(vatRateBps) || vatRateBps < 0 || vatRateBps > 10_000) {
    throw new Error("KDV oranı 0-10000 baz puan arasında olmalıdır.")
  }

  const gross = BigInt(grossAmountMinor)
  const denominator = BigInt(10_000 + vatRateBps)
  const roundedNet = (gross * BigInt(10_000) + denominator / BigInt(2)) / denominator
  const netAmountMinor = Number(roundedNet)
  if (!Number.isSafeInteger(netAmountMinor)) {
    throw new Error("KDV hariç sipariş tutarı güvenli tam sayı sınırını aşıyor.")
  }

  return {
    vatRateBps,
    grossAmountMinor,
    netAmountMinor,
  }
}
