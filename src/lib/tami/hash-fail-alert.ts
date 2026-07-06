import { prisma } from "@/lib/db"
import { getAdminEmails } from "@/lib/admin"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { founderAlertEmail } from "@/lib/emails/system-emails"

/**
 * TAMI callback hash doğrulaması başarısız olduğunda (yanlış yapılandırılmış
 * secretKey ya da sahte/kurcalanmış callback) saatlik dedup anahtarı (UTC).
 * Saf fonksiyon — CommunicationLog.findFirst ile aynı deseni izler (bkz.
 * lifecycle.ts'teki alertStuckTransactionOnce): saatte en fazla 1 founder
 * alert, log gürültüsü ayrı (mevcut console.warn AYNEN kalır).
 */
export function hashFailAlertKey(date: Date): string {
  // "2026-07-06T14:23:00.000Z".slice(0, 13) === "2026-07-06T14" → saat çözünürlüğü.
  return `hash_fail_alert:${date.toISOString().slice(0, 13)}`
}

/**
 * Hash doğrulaması başarısız bir callback için saatte en fazla bir founder
 * alert gönderir. CommunicationLog.workshopId ZORUNLU bir FK olduğundan (ve
 * hash doğrulaması, herhangi bir sipariş/workshop çözülmeden ÖNCE koşuyor)
 * dedup + log yalnız providerOrderId gerçek bir PaymentTransaction'a
 * eşleşiyorsa (dolayısıyla gerçek bir workshopId varsa) yazılır. Eşleşmezse
 * (bilinmeyen/sahte orderId) e-posta gönderilmez — zaten mevcut
 * console.warn ile loglanmış olur; tenant'sız bir CommunicationLog satırı
 * icat edilmez (tenant izolasyonu bozulmaz).
 *
 * İçerikte kart verisi YOK — yalnız providerOrderId, kaynak IP, saat.
 */
export async function alertHashFailureOnce(opts: {
  providerOrderId: string
  ip: string
  now?: Date
}): Promise<boolean> {
  if (!opts.providerOrderId) return false

  const now = opts.now ?? new Date()
  const templateKey = hashFailAlertKey(now)

  const txn = await prisma.paymentTransaction.findUnique({
    where: { providerOrderId: opts.providerOrderId },
    select: { workshopId: true },
  })
  if (!txn) return false

  const existing = await prisma.communicationLog.findFirst({
    where: { workshopId: txn.workshopId, type: "email", status: "sent", templateKey },
    select: { id: true },
  })
  if (existing) return false

  const to = getAdminEmails()
  if (to.length === 0) return false

  const detail =
    `TAMI callback hash doğrulaması başarısız oldu. providerOrderId: ${opts.providerOrderId}, ` +
    `kaynak IP: ${opts.ip}, saat: ${now.toISOString()}. Kart verisi paylaşılmadı. ` +
    `Olası sebep: secretKey yanlış yapılandırılmış ya da kurcalanmış/sahte callback denemesi. Manuel kontrol gerekli.`
  const built = founderAlertEmail({ title: "TAMI callback hash doğrulaması başarısız", detail })

  const result = await sendSystemEmail({
    to: to.join(","),
    subject: built.subject,
    html: built.html,
    workshopId: txn.workshopId,
    templateKey,
  })
  return result.ok
}
