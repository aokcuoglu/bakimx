/** Server registration switch only; never use it to resolve existing access. */
export function isLiteRegistrationOpen(): boolean {
  const value = process.env.LITE_REGISTRATION_OPEN
  return value === undefined || value.trim().toLowerCase() === "true"
}

export const LITE_REGISTRATION_CLOSED = "Lite kampanyası yeni kayıtlara kapandı. Mevcut Lite üyelerinin ücretsiz kullanım hakkı devam eder. Başka bir paket seçmek isterseniz seçiminizi kendiniz değiştirebilirsiniz."

export class LiteRegistrationClosedError extends Error {
  constructor() { super(LITE_REGISTRATION_CLOSED) }
}

export function assertLiteRegistrationOpen(tier: string): void {
  if (tier === "lite" && !isLiteRegistrationOpen()) throw new LiteRegistrationClosedError()
}

export function hasLifetimeLite(workshop: { planTier: string; liteFreeGrantedAt?: Date | null }): boolean {
  return workshop.planTier === "lite" && workshop.liteFreeGrantedAt != null
}
