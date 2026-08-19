import "server-only"
import { prisma } from "@/lib/db"
import { describeAuditAction } from "@/lib/orders/activity"
import { isWebPushConfigured } from "@/lib/push/config"
import { buildNotificationDescription, isTechnicianNotifiableAction } from "@/lib/technician/notifications"

/**
 * Teknisyen Web Push gönderim tetikleyicisi (BAK-129, Faz B).
 *
 * NEDEN `AuditLog` yazımına bağlı, cron'a değil: Faz A'nın olay kaynağı
 * `AuditLog`'tur ve tek yazım noktası `AuditLogAction`'dır. Buraya bağlanmak
 * hem "iki ayrı bildirim mantığı icat etme" kuralını korur hem de anlık
 * teslimat verir. Bir cron süpürmesi ayrıca zamanlanmış bir tetikleyici
 * gerektirirdi — bu repoda `/api/cron/*` uçlarını çağıran bir zamanlayıcı YOK
 * (bkz. `/api/cron/billing`, hiç zamanlanmadı), yani push sessizce hiç
 * çıkmazdı.
 *
 * Faz A ile aynı kurallar: yalnız atanmış teknisyenin kendi hesabına, yalnız
 * kendi atölyesinde, ve KENDİ yaptığı işlem kendisine bildirim üretmez.
 */

/** Alıcı çözümlemesi ile bildirim metni — gönderimden ayrı, saf test edilebilir kısım. */
export type TechnicianPushEvent = {
  workshopId: string
  actorUserId?: string
  entityType: string
  entityId: string
  action: string
  metadataJson?: string
  orderId?: string
}

function resolveOrderId(event: TechnicianPushEvent): string | null {
  if (event.orderId) return event.orderId
  return event.entityType === "ServiceOrder" ? event.entityId : null
}

/**
 * Bildirimi hazırlar ve gönderir. HİÇBİR KOŞULDA fırlatmaz — çağıran bir iş
 * emri mutasyonunun ortasındadır; bildirim gönderilemedi diye kaydedilmiş bir
 * değişiklik geri alınmaz.
 */
export async function dispatchTechnicianPush(event: TechnicianPushEvent): Promise<void> {
  try {
    // Sırayla en ucuz kapı önce: yapılandırma yoksa (lokal/anahtarsız ortam)
    // ve olay bildirilebilir değilse tek bir DB sorgusu bile yapılmaz.
    if (!isWebPushConfigured()) return
    if (!isTechnicianNotifiableAction(event.action)) return

    const orderId = resolveOrderId(event)
    if (!orderId) return

    const order = await prisma.serviceOrder.findFirst({
      where: { id: orderId, workshopId: event.workshopId },
      select: {
        id: true,
        workOrderNo: true,
        assignedTechnicianId: true,
        intakeForm: { select: { vehicle: { select: { plate: true } } } },
      },
    })
    if (!order?.assignedTechnicianId) return

    const built = describeAuditAction(event.action, event.metadataJson ?? null)
    if (!built) return

    // Alıcılar: bu iş emrine atanmış personel kaydına BAĞLI, aktif kullanıcılar —
    // yalnız aynı atölyede. `actorUserId` verilmişse kendisi dışarıda kalır
    // (Prisma `undefined`'ı "filtre yok" sayar, bu yüzden koşullu kuruluyor).
    const recipients = await prisma.user.findMany({
      where: {
        workshopId: event.workshopId,
        technicianId: order.assignedTechnicianId,
        isActive: true,
        ...(event.actorUserId ? { id: { not: event.actorUserId } } : {}),
      },
      select: { id: true },
    })
    if (recipients.length === 0) return

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { workshopId: event.workshopId, userId: { in: recipients.map((user) => user.id) } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
    if (subscriptions.length === 0) return

    const { sendPush } = await import("@/lib/push/send")
    await sendPush(subscriptions, {
      title: built.label,
      body: buildNotificationDescription(order.intakeForm.vehicle.plate, order.workOrderNo),
      url: `/technician/orders/${order.id}`,
      // İş emri başına tek bildirim: arka arkaya gelen durum değişiklikleri
      // kilit ekranında üst üste yığılmaz, sonuncusu öncekinin yerini alır.
      tag: `bakimx-order-${order.id}`,
    })
  } catch {
    // Bildirim yan etkidir; çağıran mutasyonu asla kırmaz.
  }
}
