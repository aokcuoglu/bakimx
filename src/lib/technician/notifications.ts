import "server-only"
import { prisma } from "@/lib/db"
import { describeAuditAction } from "@/lib/orders/activity"

/**
 * Teknisyen paneli için uygulama-içi bildirim akışı (BAK-109, Faz A).
 *
 * Ayrı bir bildirim tablosu YOK — kaynak `AuditLog`. Kapsam şu olaylarla
 * sınırlı: kendine atama, atanmış iş emrinin durum değişimi, kendi iş
 * emrindeki bir parça/işçilik talebinin karara bağlanması (hazır/teslim/
 * iptal), ve kendi iş emrine bir PARÇA eklenmesi (BAK-140 — "Yapılacak
 * İşler"nde bekleyen parça geldiğinde teknisyen fark etsin). İşçilik kalemi
 * eklenmesi bilerek dışarıda bırakılır (teknisyeni ilgilendirmez); diğer tüm
 * `AuditLog.action` değerleri (fotoğraf, ödeme vb.) de aynı gerekçeyle
 * dışarıda — teknisyene "iş emrimde bir şey değişti" gürültüsü değil, yalnız
 * doğrudan ilgilendiği kararlar gider.
 */
const EXACT_NOTIFIABLE_ACTIONS: readonly string[] = [
  "technician_assigned",
  "parts_request_prepared",
  "parts_request_delivered",
  "parts_request_cancelled",
]
const ORDER_STATUS_ACTION_PREFIX = "order_status_changed_to_"
/** `addOrderItemAction`'ın yazdığı tek eylem — parça/işçilik/dış işçilik ortak. */
const ORDER_ITEM_ADDED_ACTION = "order_item_added"

/** `order_item_added` metadata'sı bir PARÇA mı (işçilik/dış işçilik değil mi)? */
function isPartAdditionMetadata(metadataJson?: string | null): boolean {
  if (!metadataJson) return false
  try {
    const meta = JSON.parse(metadataJson) as { type?: unknown }
    return meta?.type === "part"
  } catch {
    return false
  }
}

/**
 * Bir `AuditLog.action` teknisyene bildirim üretir mi?
 *
 * Faz B (Web Push, BAK-129) bu yordamı ve aşağıdaki metin kurucusunu YENİDEN
 * KULLANIR — panel açıkken (yoklama) ve kapalıyken (push) aynı olay kümesi ve
 * aynı etiketler geçerli olsun diye. İkinci bir bildirim listesi tutulmaz.
 *
 * `order_item_added` işçilik ve parça için AYNI action string'i paylaşır —
 * ayrım yalnız `metadataJson.type` ile yapılabilir, bu yüzden ikinci parametre
 * gerekli (BAK-140).
 */
export function isTechnicianNotifiableAction(action: string, metadataJson?: string | null): boolean {
  if (action === ORDER_ITEM_ADDED_ACTION) return isPartAdditionMetadata(metadataJson)
  return EXACT_NOTIFIABLE_ACTIONS.includes(action) || action.startsWith(ORDER_STATUS_ACTION_PREFIX)
}

/** Bildirimin ikinci satırı: "34 ABC 123 · İş Emri #42". */
export function buildNotificationDescription(
  plate: string | null | undefined,
  workOrderNo: string | null | undefined,
): string | undefined {
  const orderLabel = workOrderNo ? `İş Emri #${workOrderNo}` : null
  return [plate, orderLabel].filter(Boolean).join(" · ") || undefined
}

export type TechnicianNotification = {
  id: string
  orderId: string
  createdAt: string
  title: string
  description?: string
}

export async function getTechnicianNotifications({
  workshopId,
  userId,
  technicianId,
  since,
  limit = 20,
}: {
  workshopId: string
  userId: string
  technicianId: string | null
  since: Date
  limit?: number
}): Promise<TechnicianNotification[]> {
  if (!technicianId) return []

  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, assignedTechnicianId: technicianId },
    select: {
      id: true,
      workOrderNo: true,
      intakeForm: { select: { vehicle: { select: { plate: true } } } },
    },
  })
  if (orders.length === 0) return []

  const orderIds = orders.map((order) => order.id)
  const orderById = new Map(orders.map((order) => [order.id, order]))

  const rows = await prisma.auditLog.findMany({
    where: {
      workshopId,
      actorUserId: { not: userId },
      createdAt: { gt: since },
      OR: [{ orderId: { in: orderIds } }, { entityType: "ServiceOrder", entityId: { in: orderIds } }],
      AND: {
        OR: [
          { action: { in: [...EXACT_NOTIFIABLE_ACTIONS, ORDER_ITEM_ADDED_ACTION] } },
          { action: { startsWith: ORDER_STATUS_ACTION_PREFIX } },
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  const notifications: TechnicianNotification[] = []
  for (const row of rows) {
    const orderId = row.orderId ?? (row.entityType === "ServiceOrder" ? row.entityId : null)
    const order = orderId ? orderById.get(orderId) : undefined
    if (!orderId || !order) continue
    // SQL yalnız action ile filtreler (`order_item_added` işçiliği de içerir);
    // parça/işçilik ayrımı yalnız burada, metadata ile yapılabilir.
    if (!isTechnicianNotifiableAction(row.action, row.metadataJson)) continue

    const built = describeAuditAction(row.action, row.metadataJson)
    if (!built) continue

    notifications.push({
      id: row.id,
      orderId,
      createdAt: row.createdAt.toISOString(),
      title: built.label,
      description: buildNotificationDescription(order.intakeForm.vehicle.plate, order.workOrderNo),
    })
  }
  return notifications
}
