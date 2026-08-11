/**
 * Kontrol listesinin saf hesabı — iyimser (optimistic) durum ve ilerleme.
 *
 * Bileşen bunları hem sunucu yanıtı beklenirken listeyi göstermek hem de
 * başlıktaki sayacı/ilerleme çubuğunu beslemek için kullanır: tek doğruluk
 * kaynağı, iki yerde kopya mantık yok (bkz. `order-items.ts`, aynı desen).
 */

import { isActiveChecklistItem } from "./checklist-visibility"

export interface ChecklistRow {
  id: string
  category: string
  isCompleted: boolean
  completedAt: string | null
  deletedAt: string | null
}

/**
 * Sunucuya gönderilen aksiyonun listedeki karşılığı. Silme ve geri alma da
 * iyimser: satır dokunuşla anında gider/gelir, sunucu arkada onaylar.
 */
export type ChecklistPatch =
  | { type: "toggle"; ids: readonly string[]; done: boolean }
  | { type: "delete"; ids: readonly string[] }
  | { type: "restore"; ids: readonly string[] }

/** Girdiyi mutasyona uğratmaz; yalnız hedeflenen id'lere dokunur. */
export function applyChecklistPatch<T extends ChecklistRow>(
  items: T[],
  patch: ChecklistPatch,
  now = new Date().toISOString()
): T[] {
  const target = new Set(patch.ids)
  return items.map((item) => {
    if (!target.has(item.id)) return item
    switch (patch.type) {
      case "toggle":
        return { ...item, isCompleted: patch.done, completedAt: patch.done ? now : null }
      case "delete":
        // Zaten silinmiş satırın mezar taşı tarihini ezme — "geri al" sonrası
        // ikinci silmede sıra bozulmasın.
        return item.deletedAt ? item : { ...item, deletedAt: now }
      case "restore":
        return { ...item, deletedAt: null }
    }
  })
}

/** Bu iş emrinde duran (silinmemiş) maddeler. */
export function activeChecklist<T extends ChecklistRow>(items: T[]): T[] {
  return items.filter(isActiveChecklistItem)
}

/** Bu iş emrinden çıkarılan maddeler — "Silinen maddeler" bölümü. */
export function removedChecklist<T extends ChecklistRow>(items: T[]): T[] {
  return items.filter((i) => !isActiveChecklistItem(i))
}

/**
 * Başlıktaki `5/16` sayacı ve ilerleme çubuğu. Yüzde tam sayıya yuvarlanır;
 * madde yoksa 0 (0/0 = NaN olurdu).
 */
export function checklistProgress(items: ChecklistRow[]): {
  total: number
  completed: number
  remaining: number
  percent: number
} {
  const active = activeChecklist(items)
  const completed = active.filter((i) => i.isCompleted).length
  return {
    total: active.length,
    completed,
    remaining: active.length - completed,
    percent: active.length === 0 ? 0 : Math.round((completed / active.length) * 100),
  }
}

/**
 * Bir aşamanın toplu işaretlemesinin hedefi: yalnız o kategorideki eksik
 * maddeler. İşaretli olanlar dışarıda kalır ki gerçek tamamlama zamanları
 * ezilmesin — sunucudaki `isCompleted: false` filtresinin istemci karşılığı.
 */
export function incompleteChecklistIds(items: ChecklistRow[], category?: string): string[] {
  return activeChecklist(items)
    .filter((i) => !i.isCompleted && (category === undefined || i.category === category))
    .map((i) => i.id)
}
