import type { OrderStatus } from "@prisma/client"
import { isOrderLocked } from "@/lib/status-transitions"

/** `NEXT_STATUSES[status]` girdisi (order-management-panel); başlık aksiyonlarıyla aynı kaynak. */
export type NextStatusAction = { key: string; label: string; primary?: boolean }

export type OrderNextStep = {
  /** Başlıktaki birincil düğmenin işi: "Başla", "Teslime Hazır", "Teslim Et"… */
  label: string
  /** O adımı bugün kapatan engel; yoksa null. */
  blocker: string | null
}

/**
 * Araç kabulünün sıradaki adımı ve onu kapatan engel (#911). Telefonda özet
 * kartında, masaüstünde raydaki Durum kartında görünür.
 *
 * Adım, başlıktaki birincil aksiyonla aynı girdiden (`NEXT_STATUSES`) okunur;
 * buraya ayrı bir durum makinesi yazılmaz. Lib → bileşen bağımlılığı olmasın diye
 * liste çağıran yerden gelir. Engeller sayfadaki uyarılarla aynı koşulda çıkar:
 * karar bekleyen parça talebi kilitli olmayan her emirde (Teslime Hazır'ı da
 * kapatır), fiyatsız kalem yalnız teslim adımında.
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

  let blocker: string | null = null
  if (undecidedCount > 0) blocker = `${undecidedCount} parça talebi karar bekliyor`
  else if (unpricedCount > 0 && status === "ready_for_delivery") blocker = `${unpricedCount} kalemin fiyatı girilmemiş`

  return { label, blocker }
}
