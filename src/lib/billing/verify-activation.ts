import { hasLifetimeLite } from "@/lib/lite-campaign"
import { prisma } from "@/lib/db"
import { computeTrialEnd } from "@/lib/plan"
import { AuditLogAction } from "@/lib/audit"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { welcomeTrialEmail, welcomeLiteEmail } from "@/lib/emails/system-emails"

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

  let lifetimeLite = false
  let claimed = 0
  try {
    const plan = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { planTier: true, liteFreeGrantedAt: true } })
    if (!plan) return { ok: false }
    lifetimeLite = hasLifetimeLite(plan)
    const res = await prisma.workshop.updateMany({
      where: { id: workshopId, approvalStatus: "pending" },
      data: {
        approvalStatus: "approved",
        subscriptionStatus: lifetimeLite ? "active" : "trialing",
        trialStartedAt: lifetimeLite ? null : now,
        trialEndsAt: lifetimeLite ? null : trialEndsAt,
        ...(lifetimeLite ? { currentPeriodEnd: null } : {}),
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
      const built = lifetimeLite ? welcomeLiteEmail({ firstName: owner?.firstName || "", workshopName: workshop.name }) : welcomeTrialEmail({
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
        templateKey: lifetimeLite ? "welcome_lite" : "welcome_trial",
        audience: "workshop",
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
    lifetimeLite ? "email_verified_lite_activated" : "email_verified_trial_started"
  ).catch((err) => {
    console.error("[activateVerifiedWorkshop] audit failed:", err instanceof Error ? err.message : err)
  })

  return { ok: true }
}
