import "server-only"
import { prisma } from "@/lib/db"
import { describeAuditAction } from "@/lib/orders/activity"

/**
 * Teknisyen paneli için uygulama-içi bildirim akışı (BAK-109, Faz A).
 *
 * Ayrı bir bildirim tablosu YOK — kaynak `AuditLog`. Kapsam üç olayla sınırlı:
 * kendine atama, atanmış iş emrinin durum değişimi, kendi iş emrindeki bir
 * parça/işçilik talebinin karara bağlanması (hazır/teslim/iptal). Diğer tüm
 * `AuditLog.action` değerleri (fotoğraf, ödeme, kalem vb.) bilerek dışarıda
 * bırakılır — teknisyene "iş emrimde bir şey değişti" gürültüsü değil, yalnız
 * doğrudan ilgilendiği kararlar gider.
 */
const EXACT_NOTIFIABLE_ACTIONS: readonly string[] = [
  "technician_assigned",
  "parts_request_prepared",
  "parts_request_delivered",
  "parts_request_cancelled",
]
const ORDER_STATUS_ACTION_PREFIX = "order_status_changed_to_"

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
          { action: { in: [...EXACT_NOTIFIABLE_ACTIONS] } },
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

    const built = describeAuditAction(row.action, row.metadataJson)
    if (!built) continue

    const orderLabel = order.workOrderNo ? `İş Emri #${order.workOrderNo}` : null
    notifications.push({
      id: row.id,
      orderId,
      createdAt: row.createdAt.toISOString(),
      title: built.label,
      description: [order.intakeForm.vehicle.plate, orderLabel].filter(Boolean).join(" · ") || undefined,
    })
  }
  return notifications
}
