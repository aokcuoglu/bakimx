import type { OrderStatus } from "@prisma/client"
import { isOrderLocked } from "@/lib/status-transitions"

/**
 * Dış alım (ServiceOrderItem source=purchase) kaydını DEĞİŞTİRME kuralı — BAK-83
 * (silme), BAK-84 (düzenleme).
 *
 * Dış alım ayrı bir defter değil, iş emrinin bir kalemidir: teknisyen ekranındaki
 * "Dışarıdan Alınan Parçalar" listesi ile iş emri kalem tablosu AYNI satırı
 * gösterir. Bu yüzden silme her iki yüzeyden de kalemi komple kaldırır — toplam,
 * kâr/maliyet ve /purchases listesi aynı anda düşer.
 *
 * Düzenleme AYNI kapıdan geçer: parçanın adını/numarasını/miktarını değiştirmek
 * de kalemin kimliğini ve tutarını değiştirir. Silemeyen bir rolün düzenleyebiliyor
 * olması kapının kendisini anlamsız kılardı.
 *
 * Kural iki kademeli:
 *
 *  1. `delivered` / `cancelled` (bkz. `isOrderLocked`) — araç çıkmış, kayıt
 *     kapanmıştır: kimse silemez. Yanlış bir kalem kaldıysa iş emri önce
 *     yeniden açılır (`order.reopen`).
 *  2. `ready_for_delivery` — teknisyenin işi bitmiş, araç teslime hazır. Bu
 *     noktada maliyet kaydı faturaya/tahsilata esas alınmış olabilir; düzeltme
 *     ofisin kararıdır. Yalnız `order.edit` taşıyan roller (usta, servis müdürü,
 *     yönetici) silebilir; `parts.purchase` ile sınırlı çırak silemez.
 *
 * Diğer tüm durumlarda (draft, waiting_approval, approved, in_progress,
 * waiting_parts) iş emri açıktır ve parçayı kaydeden kişi kendi hatasını
 * düzeltebilmelidir: `parts.purchase` yeterlidir.
 *
 * Kural sunucu (action) ve arayüz (buton görünürlüğü + gerekçe metni) tarafında
 * ayrı ayrı yazılmasın diye tek kaynak burasıdır.
 */

export type PurchaseDeleteDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

export const PURCHASE_DELETE_LOCKED_REASON =
  "Teslim edilmiş veya iptal edilmiş iş emrinde dış alım kaydı düzenlenemez veya silinemez"

export const PURCHASE_DELETE_OFFICE_ONLY_REASON =
  "Teslime hazır iş emrinde dış alım kaydını yalnız iş emrini düzenleyebilen roller değiştirebilir"

/**
 * @param orderStatus İş emrinin güncel durumu.
 * @param canEditOrder Kullanıcı `order.edit` iznine sahip mi (usta/müdür/yönetici).
 */
export function purchaseDeleteDecision(
  orderStatus: OrderStatus,
  canEditOrder: boolean,
): PurchaseDeleteDecision {
  if (isOrderLocked(orderStatus)) {
    return { allowed: false, reason: PURCHASE_DELETE_LOCKED_REASON }
  }
  if (orderStatus === "ready_for_delivery" && !canEditOrder) {
    return { allowed: false, reason: PURCHASE_DELETE_OFFICE_ONLY_REASON }
  }
  return { allowed: true }
}

/** Karar nesnesine ihtiyaç duymayan çağrı yerleri için kısayol. */
export function canDeletePurchaseItem(orderStatus: OrderStatus, canEditOrder: boolean): boolean {
  return purchaseDeleteDecision(orderStatus, canEditOrder).allowed
}
