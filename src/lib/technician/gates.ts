/**
 * İş emri geçişlerinin saf hesabı. Server action'lar veriyi çeker,
 * burada karar verilir; aynı fonksiyonlar UI'da buton durumunu göstermek
 * için de kullanılır (tek doğruluk kaynağı, iki yerde kopya mantık yok).
 *
 * KONTROL LİSTESİ ARTIK KAPI DEĞİL (BAK-24): eksik kontrol maddesi ne "Tamire
 * Başla"yı ne de "Tamamla"yı engeller. Atölyeler listeyi kendi akışlarına göre
 * kullanıyor; zorunlu tutmak teknisyeni maddeleri gerçekten yapmadan toplu
 * işaretlemeye itiyordu — kayıt da o anda değerini yitiriyordu. Tek kalan kapı
 * iş kalemleridir:
 * "yapıldı" işaretlenmemiş parça/işçilik iş emrini kapattırmaz.
 */

import { isActiveChecklistItem } from "./checklist-visibility"

export interface GateChecklistItem {
  category: string
  isCompleted: boolean
  /** Bu iş emrinde silinmiş madde — ne hatırlatmada ne özette görünür. */
  deletedAt?: Date | string | null
}

export interface GateOrderItem {
  completedAt: Date | string | null
}

export function countIncompleteItems(items: GateOrderItem[]): number {
  return items.filter((i) => !i.completedAt).length
}

/**
 * Kapalı gelen "Kontrol Listesi" başlığındaki özet: teknisyen bölümü açmadan
 * ilerlemeyi ve kalan madde sayısını görebilsin.
 */
export function summarizeChecklist(items: GateChecklistItem[]): {
  total: number
  completed: number
  remaining: number
} {
  const active = items.filter(isActiveChecklistItem)
  const completed = active.filter((i) => i.isCompleted).length
  return { total: active.length, completed, remaining: active.length - completed }
}

/**
 * Tek gerçek kapı: iş kalemleri. Kontrol maddesi buraya bilinçli olarak
 * girmiyor (bkz. dosya başı).
 */
export function completeWorkBlockMessage(missingItems: number): string | null {
  if (missingItems <= 0) return null
  return `İş tamamlanamaz: ${missingItems} iş kalemi "yapıldı" olarak işaretlenmedi`
}
