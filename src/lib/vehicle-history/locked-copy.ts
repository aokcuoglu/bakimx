/**
 * Maskeli geçmiş kartının "kilidi nasıl açarım" cümlesi (#853).
 *
 * Ruhsat okutma (`ocrIntake`) ek özelliktir: kapalı atölyeye "ruhsatı
 * okuttuğunuzda açılır" demek yapamayacağı bir eylemi vaat eder. O atölyede
 * elle doğrulanabilir tek yol bu araç için kendi araç kabulünü açmaktır
 * (`resolveVehicleHistoryAccess` → `own_record`).
 */
export type LockedHistoryHint = {
  /** Vurgulanan (kalın) eylem. */
  action: string
  /** Eylemden sonra gelen metin. */
  tail: string
}

export function lockedHistoryHint(ocrEnabled: boolean): LockedHistoryHint {
  return ocrEnabled
    ? { action: "ruhsatı okuttuğunuzda", tail: " tamamı açılır." }
    : { action: "bu araç için araç kabulü açtığınızda", tail: " tamamı açılır." }
}
