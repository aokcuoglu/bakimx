import { prisma } from "@/lib/db"
import { getAdminEmails } from "@/lib/admin"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { founderAlertEmail } from "@/lib/emails/system-emails"

/**
 * Kart akışı (initiate + callback) kapatılmalı mı? Saf fonksiyon — iki route'un
 * paylaştığı TEK guard koşulu. KASITLI olarak NODE_ENV tabanlıdır, TAMI_ENV
 * DEĞİL: gerçek hata modu prod .env'e TAMI bloğunun HİÇ girmemesidir — o zaman
 * TAMI_ENV de unset olur, config "sandbox"a düşer ve TAMI_ENV tabanlı bir guard
 * bypass edilirdi (public mock secret ile bedava aktivasyon). NODE_ENV=production
 * her prod build'de garantidir. Local dev (NODE_ENV=development) mock ile
 * çalışmaya devam eder; staging go-live checklist adım 1 gereği sandbox kimlik
 * bilgileri kullanır. Bilerek TAMI_ALLOW_MOCK gibi bir kaçış kapısı YOK.
 */
export function isCardPaymentBlocked(opts: {
  nodeEnv: string | undefined
  tamiConfigured: boolean
}): boolean {
  return opts.nodeEnv === "production" && !opts.tamiConfigured
}

/**
 * TAMI production ortamında kimlik bilgileri eksik olduğunda (mock istemciye
 * sessizce düşmenin engellendiği durum) GÜNLÜK dedup anahtarı (UTC). Saf
 * fonksiyon — hash-fail-alert.ts ile aynı deseni izler; günde en fazla 1
 * founder alert (yapılandırma unutulmuşsa e-posta seli olmasın diye).
 */
export function misconfigAlertKey(date: Date): string {
  // "2026-07-06T14:23:00.000Z".slice(0, 10) === "2026-07-06" → gün çözünürlüğü.
  return `tami_misconfig_alert:${date.toISOString().slice(0, 10)}`
}

/**
 * Production'da TAMI yapılandırması eksikken bir kart ödemesi denendiğinde günde
 * en fazla bir founder alert gönderir. CommunicationLog.workshopId zorunlu bir
 * FK olduğundan siparişin workshopId'si kullanılır (bkz. hash-fail-alert.ts).
 * İçerikte kart verisi YOK — yalnız referans + workshopId.
 */
export async function alertTamiMisconfigOnce(opts: {
  workshopId: string
  reference: string
  now?: Date
}): Promise<boolean> {
  if (!opts.workshopId) return false

  const now = opts.now ?? new Date()
  const templateKey = misconfigAlertKey(now)

  const existing = await prisma.communicationLog.findFirst({
    where: { workshopId: opts.workshopId, type: "email", status: "sent", templateKey },
    select: { id: true },
  })
  if (existing) return false

  const to = getAdminEmails()
  if (to.length === 0) return false

  const detail =
    `TAMI production ortamında kimlik bilgileri EKSİK — kart ödemesi kapalı ve bir müşteri ` +
    `ödeme başlatmaya çalıştı (sipariş referansı: ${opts.reference}, saat: ${now.toISOString()}). ` +
    `Mock istemciye sessizce düşme engellendi (bedava aktivasyon riski yok). ` +
    `Prod .env'de TAMI_MERCHANT_NUMBER / TAMI_TERMINAL_NUMBER / TAMI_SECRET_KEY / TAMI_JWK_KID / ` +
    `TAMI_JWK_KEY değerlerini doldurup uygulamayı yeniden başlatın. Acil kontrol gerekli.`
  const built = founderAlertEmail({ title: "TAMI production yapılandırması eksik — kart ödemesi kapalı", detail })

  const result = await sendSystemEmail({
    to: to.join(","),
    subject: built.subject,
    html: built.html,
    workshopId: opts.workshopId,
    templateKey,
  })
  return result.ok
}
