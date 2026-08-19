import "server-only"
import { prisma } from "@/lib/db"
import { describeAuditAction } from "@/lib/orders/activity"
import { isWebPushConfigured } from "@/lib/push/config"
import { buildNotificationDescription, isTechnicianNotifiableAction } from "@/lib/technician/notifications"
import type { PushPayload, PushTarget } from "@/lib/push/send"

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
 *
 * NEDEN İKİ FONKSİYON: alıcı/metin çözümlemesi (`resolveTechnicianPushDelivery`)
 * teslimattan ayrıdır ve testi `@/lib/push/send`'i HİÇ yüklemeden yapılır.
 * Ayrım kozmetik değil: `mock.module` bun'da süreç geneli ve kalıcıdır, yani
 * burada `@/lib/push/send`'i sahtelemek `src/lib/push/send.test.ts`'i dosya
 * sırasına göre düşürüyordu (CI kırmızısı, 19-08). Bu modülü test ederken
 * `@/lib/push/send`'i sahteleme — çözümlemeyi doğrudan çağır.
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

/** Çözümlenmiş teslimat: kime ve ne gönderilecek. Gönderimin kendisi ayrı. */
export type TechnicianPushDelivery = { targets: PushTarget[]; payload: PushPayload }

function resolveOrderId(event: TechnicianPushEvent): string | null {
  if (event.orderId) return event.orderId
  return event.entityType === "ServiceOrder" ? event.entityId : null
}

/**
 * Olaydan alıcıları ve bildirim gövdesini çözer; gönderilecek bir şey yoksa
 * `null` döner. Fırlatabilir — `dispatchTechnicianPush` yutar.
 */
export async function resolveTechnicianPushDelivery(
  event: TechnicianPushEvent,
): Promise<TechnicianPushDelivery | null> {
  // Sırayla en ucuz kapı önce: yapılandırma yoksa (lokal/anahtarsız ortam)
  // ve olay bildirilebilir değilse tek bir DB sorgusu bile yapılmaz.
  if (!isWebPushConfigured()) return null
  if (!isTechnicianNotifiableAction(event.action, event.metadataJson)) return null

  const orderId = resolveOrderId(event)
  if (!orderId) return null

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: event.workshopId },
    select: {
      id: true,
      workOrderNo: true,
      assignedTechnicianId: true,
      intakeForm: { select: { vehicle: { select: { plate: true } } } },
    },
  })
  if (!order?.assignedTechnicianId) return null

  const built = describeAuditAction(event.action, event.metadataJson ?? null)
  if (!built) return null

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
  if (recipients.length === 0) return null

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { workshopId: event.workshopId, userId: { in: recipients.map((user) => user.id) } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  if (subscriptions.length === 0) return null

  return {
    targets: subscriptions,
    payload: {
      title: built.label,
      body: buildNotificationDescription(order.intakeForm.vehicle.plate, order.workOrderNo),
      url: `/technician/orders/${order.id}`,
      // İş emri başına tek bildirim: arka arkaya gelen durum değişiklikleri
      // kilit ekranında üst üste yığılmaz, sonuncusu öncekinin yerini alır.
      tag: `bakimx-order-${order.id}`,
    },
  }
}

/**
 * Bildirimi hazırlar ve gönderir. HİÇBİR KOŞULDA fırlatmaz — çağıran bir iş
 * emri mutasyonunun ortasındadır; bildirim gönderilemedi diye kaydedilmiş bir
 * değişiklik geri alınmaz.
 */
export async function dispatchTechnicianPush(event: TechnicianPushEvent): Promise<void> {
  try {
    const delivery = await resolveTechnicianPushDelivery(event)
    if (!delivery) return

    const { sendPush } = await import("@/lib/push/send")
    await sendPush(delivery.targets, delivery.payload)
  } catch {
    // Bildirim yan etkidir; çağıran mutasyonu asla kırmaz.
  }
}
