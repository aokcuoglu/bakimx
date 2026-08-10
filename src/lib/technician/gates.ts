/**
 * Zorunluluk kapılarının saf hesabı. Server action'lar veriyi çeker,
 * burada karar verilir; aynı fonksiyonlar UI'da buton durumunu göstermek
 * için de kullanılır (tek doğruluk kaynağı, iki yerde kopya mantık yok).
 */

import { isActiveChecklistItem } from "./checklist-visibility"

export interface GateChecklistItem {
  category: string
  isCompleted: boolean
  isRequired: boolean
  /** Bu iş emrinde silinmiş madde — kapıyı da özeti de etkilemez. */
  deletedAt?: Date | string | null
}

export interface GateOrderItem {
  completedAt: Date | string | null
}

/** "Tamire Başla" kapısı: araç teslim alınırken yapılması gerekenler. */
export const START_GATE_CATEGORIES = ["inspection"] as const
/** "Tamamla" kapısı: onarım ve teslim kontrolleri. */
export const COMPLETE_GATE_CATEGORIES = ["repair", "delivery"] as const

/**
 * Silinen maddeler burada da elenir: çağıranın sorgusu `ACTIVE_CHECKLIST_ITEM`
 * filtresini atlasa bile silinmiş bir madde kapıyı kilitli tutmasın — kullanıcı
 * o maddeyi bilinçli olarak bu iş emrinden çıkardı.
 */
export function countBlockingChecklist(
  items: GateChecklistItem[],
  categories: readonly string[]
): number {
  return items.filter(
    (i) => isActiveChecklistItem(i) && i.isRequired && !i.isCompleted && categories.includes(i.category)
  ).length
}

export function countIncompleteItems(items: GateOrderItem[]): number {
  return items.filter((i) => !i.completedAt).length
}

/**
 * Kapalı gelen "Kontrol Listesi" başlığındaki özet: teknisyen bölümü açmadan
 * ilerlemeyi ve kalan zorunlu madde sayısını görebilsin.
 */
export function summarizeChecklist(items: GateChecklistItem[]): {
  total: number
  completed: number
  missingRequired: number
} {
  const active = items.filter(isActiveChecklistItem)
  return {
    total: active.length,
    completed: active.filter((i) => i.isCompleted).length,
    missingRequired: active.filter((i) => i.isRequired && !i.isCompleted).length,
  }
}

export function startWorkBlockMessage(missingChecklist: number): string | null {
  if (missingChecklist <= 0) return null
  return `Araç kabul kontrolleri tamamlanmadan tamire başlanamaz (${missingChecklist} madde eksik)`
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
