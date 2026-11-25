import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { ReferralShare } from "@/components/settings/referral-share"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildReferralRegistrationUrl, isValidReferralCode } from "@/lib/referral-code"
import { getPlanState } from "@/lib/plan"
import { actorCan } from "@/lib/roles"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { getOrCreateWorkshopReferralCode } from "@/lib/workshop-referral"
import styles from "./referrals.module.css"

export const metadata = { title: "Referanslar" }

export default async function ReferralsSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !user.isActive) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }
  if (!actorCan(user, "settings.manage")) redirect("/dashboard")

  const workshop = await prisma.workshop.findUnique({ where: { id: user.workshopId } })
  const referralCode = workshop?.referralCode || (
    workshop && !user.impersonatorAdminId && !user.mustChangePassword && getPlanState(workshop).canWrite
      ? await getOrCreateWorkshopReferralCode(user.workshopId)
      : null
  )
  const referralUrl = referralCode && isValidReferralCode(referralCode)
    ? buildReferralRegistrationUrl(process.env.APP_URL || "http://localhost:3001", referralCode)
    : null

  return (
    <AppShell pageTitle="Referanslar">
      <div className={styles.content}>
        <header className="border-b border-border pb-5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">İş yerlerine ilk yıl %10 indirim sunun</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bağlantınızla kaydolan yeni iş yerleri, ilk yıl boyunca Servis Paketi siparişlerinde %10 indirim kazanır.
          </p>
        </header>

        <section className="pt-8" aria-labelledby="referral-share-heading">
          <h3 id="referral-share-heading" className="text-sm font-semibold text-foreground">Davet bağlantınızı paylaşın</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bağlantıyı açan kişi kayıt formunda referans kodunuzu hazır bulur.
          </p>
          {referralUrl && referralCode ? (
            <ReferralShare referralUrl={referralUrl} referralCode={referralCode} />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Bu iş yeri için paylaşım bağlantısı şu anda oluşturulamıyor.</p>
          )}
        </section>
      </div>
    </AppShell>
  )
}
