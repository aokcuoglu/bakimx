/**
 * Durum tablolarının (`constants.ts`, `cashbox/status.ts`, `parts/status.ts`)
 * renk sözleşmesi: sınıf dizisi değil ton adı (#1021). Tonun nasıl boyandığı
 * tek yerde, `Badge` variant'larında (`badge.tsx`) durur — açık/koyu tema ve
 * kontrast oradan gelir.
 */
export type StatusTone = "success" | "warning" | "destructive" | "primary" | "neutral"

export type StatusToneBadgeVariant =
  | "success-tint"
  | "warning-tint"
  | "destructive-tint"
  | "primary-tint"
  | "secondary"

const TONE_VARIANT: Record<StatusTone, StatusToneBadgeVariant> = {
  success: "success-tint",
  warning: "warning-tint",
  destructive: "destructive-tint",
  primary: "primary-tint",
  neutral: "secondary",
}

/** Ton → `Badge` variant'ı. Tanımsız/bilinmeyen ton nötre düşer. */
export function statusToneBadgeVariant(tone: StatusTone | undefined | null): StatusToneBadgeVariant {
  return tone && Object.hasOwn(TONE_VARIANT, tone) ? TONE_VARIANT[tone] : "secondary"
}
