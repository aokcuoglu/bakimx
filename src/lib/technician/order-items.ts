/**
 * "Yapılacak İşler" listesinin saf hesabı. Bileşen bunları hem iyimser
 * (optimistic) durumu üretmek hem de başlıktaki sayacı ve "Tümünü tamamla"
 * butonunun durumunu göstermek için kullanır — tek doğruluk kaynağı.
 */

export interface CompletableItem {
  id: string
  completedAt: string | null
}

/**
 * Sunucu yanıtı beklenirken listenin görüneceği hâl. Yalnız hedeflenen id'lere
 * dokunur ve girdiyi mutasyona uğratmaz.
 */
export function applyCompletion<T extends CompletableItem>(
  items: T[],
  ids: readonly string[],
  done: boolean,
  now = new Date().toISOString()
): T[] {
  const target = new Set(ids)
  return items.map((item) =>
    target.has(item.id) ? { ...item, completedAt: done ? now : null } : item
  )
}

/** Başlıktaki `3/12` sayacı ve butonun etkinliği. */
export function completionSummary(items: CompletableItem[]): {
  total: number
  done: number
  remaining: number
} {
  const done = items.filter((i) => i.completedAt).length
  return { total: items.length, done, remaining: items.length - done }
}

/**
 * Toplu tamamlamanın hedefi: yalnız eksik kalemler. Zaten işaretli kalemler
 * dışarıda kalır ki gerçek tamamlama zamanları ezilmesin — sunucu tarafındaki
 * `completedAt: null` filtresinin istemci karşılığı.
 */
export function incompleteIds(items: CompletableItem[]): string[] {
  return items.filter((i) => !i.completedAt).map((i) => i.id)
}
