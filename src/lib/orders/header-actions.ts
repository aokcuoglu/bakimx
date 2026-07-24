/**
 * Detay başlığındaki aksiyonların "tek birincil buton + taşma menüsü" düzenine
 * bölünmesi.
 *
 * Başlık üç katman taşır — kimlik (plaka/araç/müşteri/usta), durum (okunacak
 * rozetler), aksiyon. Aksiyon katmanında birden fazla eşit ağırlıklı CTA olması
 * hiyerarşiyi bozuyordu; bu yüzden yalnız birincil geçiş buton olarak kalır,
 * kalanı `⋯` menüsüne iner.
 */

export type SplittableAction = {
  key: string
  tone: "primary" | "secondary" | "danger"
}

const OVERFLOW_TONE_ORDER: Record<SplittableAction["tone"], number> = {
  primary: 0,
  secondary: 1,
  danger: 2, // yıkıcı işlem menünün en altında, ayırıcının ardında durur
}

export function splitHeaderActions<T extends SplittableAction>(
  actions: readonly T[]
): { primary: T | null; overflow: T[] } {
  const primaryIndex = actions.findIndex((a) => a.tone === "primary")
  const primary = primaryIndex === -1 ? null : actions[primaryIndex]

  const overflow = actions
    .filter((_, i) => i !== primaryIndex)
    .sort((a, b) => OVERFLOW_TONE_ORDER[a.tone] - OVERFLOW_TONE_ORDER[b.tone])

  return { primary, overflow }
}
