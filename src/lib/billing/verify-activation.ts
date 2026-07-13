import { prisma } from "@/lib/db"
import { computeTrialEnd } from "@/lib/plan"
import { AuditLogAction } from "@/lib/audit"
import { getAdminEmails } from "@/lib/admin"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { welcomeTrialEmail, founderAlertEmail } from "@/lib/emails/system-emails"

/**
 * E-posta doğrulaması tamamlandığında pending workshop'u active bir denemeye çevirir.
 *
 * Güvenlik/idempotency değişmezleri:
 *  - CLAIM-GUARD: updateMany yalnız `approvalStatus: "pending"` satırı sahiplenir.
 *    count===1 → gerçek geçiş (welcome e-postası + audit BURADA çalışır — register'dan
 *    KALKTI, çifte gönderim olmaz). count===0 → workshop zaten approved (callback replay
 *    ya da eşzamanlı ikinci callback) → YAN ETKİSİZ ok:true.
 *  - trial CALLBACK'te başlar (register pending yaratır, trial* null bırakır).
 *  - Beklenmedik DB hatası → ok:false (çağıran founder alert + txn'i completed YAPMAZ).
 */
export async function activateVerifiedWorkshop(workshopId: string): Promise<{ ok: boolean }> {
  const now = new Date()
  const trialEndsAt = computeTrialEnd(now)

  let claimed = 0
  try {
    const res = await prisma.workshop.updateMany({
      where: { id: workshopId, approvalStatus: "pending" },
      data: {
        approvalStatus: "approved",
        subscriptionStatus: "trialing",
        trialStartedAt: now,
        trialEndsAt,
      },
    })
    claimed = res.count
  } catch (err) {
    console.error("[activateVerifiedWorkshop] update failed:", err instanceof Error ? err.message : err)
    return { ok: false }
  }

  // Zaten approved (replay / yarış) — hiçbir yan etki üretmeden idempotent başarı.
  if (claimed === 0) return { ok: true }

  // count===1: gerçek geçiş. Bildirim + audit best-effort — hata aktivasyonu BOZMAZ.
  try {
    const [workshop, owner] = await Promise.all([
      prisma.workshop.findUnique({ where: { id: workshopId }, select: { name: true, email: true } }),
      prisma.user.findFirst({
        where: { workshopId, role: "owner" },
        orderBy: { createdAt: "asc" },
        select: { email: true, firstName: true },
      }),
    ])
    const to = owner?.email || workshop?.email
    if (workshop && to) {
      const built = welcomeTrialEmail({
        ownerName: owner?.firstName || "",
        workshopName: workshop.name,
        trialEndsAt,
      })
      // Tek-gönderim garantisi CLAIM-GUARD'dır: bu blok yalnız claimed===1
      // (gerçek pending→approved geçişi) olunca çalışır, dolayısıyla welcome
      // e-postası workshop başına bir kez gider. (sendSystemEmail'in kendisi
      // CommunicationLog ile dedup ETMEZ.)
      await sendSystemEmail({
        to,
        subject: built.subject,
        html: built.html,
        workshopId,
        templateKey: "welcome_trial",
      })
    }
  } catch (err) {
    console.error("[activateVerifiedWorkshop] welcome email failed:", err instanceof Error ? err.message : err)
  }

  await AuditLogAction(
    workshopId,
    undefined,
    "Workshop",
    workshopId,
    "email_verified_trial_started"
  ).catch((err) => {
    console.error("[activateVerifiedWorkshop] audit failed:", err instanceof Error ? err.message : err)
  })

  return { ok: true }
}

/**
 * 1 TL doğrulama provizyonu başarıyla alındıktan sonra otomatik iptal (cancel)
 * BAŞARISIZ olursa founder'ı uyarır — provizyon 7-9 günde kendiliğinden düşer, akış
 * BOZULMAZ. Dedup: CommunicationLog templateKey `verify_cancel_fail:<providerOrderId>`
 * (alertHashFailureOnce / alertStuckTransactionOnce desenine göre; işlem başına en fazla
 * bir e-posta). İçerikte kart verisi YOK — yalnız providerOrderId + saat.
 */
export async function alertVerifyCancelFailureOnce(opts: {
  providerOrderId: string
  workshopId: string
  now?: Date
}): Promise<boolean> {
  if (!opts.providerOrderId || !opts.workshopId) return false
  const now = opts.now ?? new Date()
  const templateKey = `verify_cancel_fail:${opts.providerOrderId}`

  const existing = await prisma.communicationLog.findFirst({
    where: { workshopId: opts.workshopId, type: "email", status: "sent", templateKey },
    select: { id: true },
  })
  if (existing) return false

  const to = getAdminEmails()
  if (to.length === 0) return false

  const detail =
    `Kart doğrulama başarılı oldu ancak 1 TL ön provizyon otomatik iptali başarısız oldu. ` +
    `providerOrderId: ${opts.providerOrderId}, saat: ${now.toISOString()}. ` +
    `Bloke tutar 7-9 iş günü içinde bankaca kendiliğinden düşer; kullanıcı akışı etkilenmedi. ` +
    `Gerekirse TAMI panelinden manuel iptal edilebilir.`
  const built = founderAlertEmail({ title: "1 TL doğrulama provizyonu iptal edilemedi", detail })

  const result = await sendSystemEmail({
    to: to.join(","),
    subject: built.subject,
    html: built.html,
    workshopId: opts.workshopId,
    templateKey,
  })
  return result.ok
}
