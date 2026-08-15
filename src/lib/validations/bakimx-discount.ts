import { z } from "zod/v4"

/**
 * BakımX workshop discount validation (BAK-47).
 *
 * Admin UI form katmanı: form değerleri yüzde (0-100), string olarak gelebilir.
 * Server action katmanı: sunucu bps'e çevirir (0-10000, 2000 = %20).
 */

export const bakimxDiscountFormSchema = z.object({
  /** Yüzde: 0-100 aralığında, ondalık destekler (örn: "15.5" = %15.5 = 1550 bps). */
  discountPercent: z.coerce
    .number()
    .min(0, "İskonto %0 ile %100 arasında olmalıdır")
    .max(100, "İskonto %0 ile %100 arasında olmalıdır"),
})

export type BakimxDiscountFormValues = z.infer<typeof bakimxDiscountFormSchema>

export const bakimxDiscountInputSchema = z.object({
  /** Basis points (0-10000): 2000 = %20. Sunucu katmanında tam sayı. */
  bakimxDiscountBps: z.coerce
    .number()
    .int("İskonto tam sayı (bps) olmalıdır")
    .min(0, "İskonto negatif olamaz")
    .max(10000, "İskonto %100'ü geçemez"),
})

export type BakimxDiscountInput = z.infer<typeof bakimxDiscountInputSchema>

/**
 * Yüzde → basis points dönüşümü.
 * Örn: 15.5 → 1550 bps.
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}

/**
 * Basis points → yüzde dönüşümü.
 * Örn: 1550 bps → 15.5
 */
export function bpsToPercent(bps: number): number {
  return bps / 100
}
