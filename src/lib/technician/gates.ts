/**
 * Zorunluluk kapılarının saf hesabı. Server action'lar veriyi çeker,
 * burada karar verilir; aynı fonksiyonlar UI'da buton durumunu göstermek
 * için de kullanılır (tek doğruluk kaynağı, iki yerde kopya mantık yok).
 */

export interface GateChecklistItem {
  category: string
  isCompleted: boolean
  isRequired: boolean
}

export interface GateOrderItem {
  completedAt: Date | string | null
}

/** "İşe Başla" kapısı: araç teslim alınırken yapılması gerekenler. */
export const START_GATE_CATEGORIES = ["inspection"] as const
/** "Tamamla" kapısı: onarım ve teslim kontrolleri. */
export const COMPLETE_GATE_CATEGORIES = ["repair", "delivery"] as const

export function countBlockingChecklist(
  items: GateChecklistItem[],
  categories: readonly string[]
): number {
  return items.filter((i) => i.isRequired && !i.isCompleted && categories.includes(i.category)).length
}

export function countIncompleteItems(items: GateOrderItem[]): number {
  return items.filter((i) => !i.completedAt).length
}

export function startWorkBlockMessage(missingChecklist: number): string | null {
  if (missingChecklist <= 0) return null
  return `Araç kabul kontrolleri tamamlanmadan işe başlanamaz (${missingChecklist} madde eksik)`
}

export function completeWorkBlockMessage(
  missingChecklist: number,
  missingItems: number
): string | null {
  if (missingChecklist <= 0 && missingItems <= 0) return null
  if (missingChecklist > 0 && missingItems > 0) {
    return `İş tamamlanamaz: ${missingChecklist} kontrol maddesi ve ${missingItems} iş kalemi eksik`
  }
  if (missingChecklist > 0) {
    return `İş tamamlanamaz: ${missingChecklist} kontrol maddesi eksik`
  }
  return `İş tamamlanamaz: ${missingItems} iş kalemi "yapıldı" olarak işaretlenmedi`
}
