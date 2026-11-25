import { IN_SERVICE_ORDER_FILTER, IN_SERVICE_ORDER_STATUSES } from "@/lib/orders/status-filter"
import { UNASSIGNED_TECHNICIAN } from "@/lib/orders/technician-filter"

/**
 * Genel Bakış'taki "N araç kabulü usta bekliyor" uyarısı (#833).
 *
 * Kartın saydığı küme ile bağlantısının açtığı liste aynı tanımdan gelir:
 * serviste (teslim edilmemiş / iptal olmamış) ve ustası atanmamış emirler.
 * Eskiden sayı teslim/iptal emirleri dışarıda bırakıyor, bağlantı ise yalnız
 * `?technician=none` açıyordu; liste teslim edilmişleri de sayıyordu.
 */
export const UNASSIGNED_IN_SERVICE_WHERE = {
  assignedTechnicianId: null,
  status: { in: IN_SERVICE_ORDER_STATUSES },
}

export const UNASSIGNED_IN_SERVICE_HREF =
  `/orders?status=${IN_SERVICE_ORDER_FILTER}&technician=${UNASSIGNED_TECHNICIAN}`

/**
 * Kabul "usta bekliyor" listesinden mi açıldı? (#866) `returnTo` ile gelen,
 * `orderListReturnHref`ten geçmiş liste adresi verilir. Usta filtresi
 * "Atanmamış" ise evet — durum filtresi ve arama önemsiz. Detay sayfası bu
 * durumda "henüz usta atanmadı" notunu ve atamadan sonra "Listeye dön"ü gösterir.
 */
export function isUnassignedListHref(listHref: string | null | undefined): boolean {
  if (!listHref) return false
  const query = listHref.split("?")[1]
  if (!query) return false
  return new URLSearchParams(query).get("technician") === UNASSIGNED_TECHNICIAN
}
