import type { OrderStatus } from "@prisma/client"
import { isOrderLocked } from "@/lib/status-transitions"

/** `NEXT_STATUSES[status]` girdisi (order-management-panel); başlık aksiyonlarıyla aynı kaynak. */
export type NextStatusAction = { key: string; label: string; primary?: boolean }

export type OrderNextStep = {
  /** Başlıktaki birincil düğmenin işi: "Başla", "Teslime Hazır", "Teslim Et"… */
  label: string
  /** O adımı (başlıktaki düğmeyi) bugün kapatan engel; yoksa null. */
  blocker: string | null
  /** Sıradaki adımı kapatmayan ama ileride kapatacak açık iş; yoksa null. */
  note: string | null
}

/**
 * Araç kabulünün sıradaki adımı ve onu kapatan engel (#911). Telefonda özet
 * kartında, masaüstünde raydaki Durum kartında görünür.
 *
 * Adım, başlıktaki birincil aksiyonla aynı girdiden (`NEXT_STATUSES`) okunur;
 * buraya ayrı bir durum makinesi yazılmaz. Lib → bileşen bağımlılığı olmasın diye
 * liste çağıran yerden gelir.
 *
 * Engel yalnız sıradaki adımın düğmesini gerçekten kapatıyorsa engeldir —
 * başlıktaki `disabled` kuralıyla aynı: karar bekleyen parça talebi "Teslime
 * Hazır"ı ve teslimi, fiyatsız kalem teslimi kapatır. Sıradaki adım başka bir
 * şeyse (ör. "Başla", "Devam Et") karar bekleyen talep nötr bir not olur;
 * fiyatsız kalem teslimden önce beklenen bir eksik olduğu için hiç yazılmaz.
 *
 * Teslim edilmiş ve iptal emirde sıradaki adım yoktur → null.
 */
export function orderNextStep({
  status,
  actions,
  unpricedCount,
  undecidedCount,
}: {
  status: string
  actions: readonly NextStatusAction[]
  unpricedCount: number
  undecidedCount: number
}): OrderNextStep | null {
  if (isOrderLocked(status as OrderStatus)) return null
  const primary = actions.find((action) => action.primary)
  if (!primary) return null
  // Başlık teslim düğmesini "Teslim Et (OTP)" diye yazar; durum satırında yöntem yazılmaz.
  const label = primary.key === "delivered" ? "Teslim Et" : primary.label

  const undecided = undecidedCount > 0 ? `${undecidedCount} parça talebi karar bekliyor` : null
  const unpriced = unpricedCount > 0 ? `${unpricedCount} kalemin fiyatı girilmemiş` : null
  const partsGate = primary.key === "ready_for_delivery" || primary.key === "delivered"

  if (partsGate && undecided) return { label, blocker: undecided, note: null }
  if (primary.key === "delivered" && unpriced) return { label, blocker: unpriced, note: null }
  return { label, blocker: null, note: undecided }
}
