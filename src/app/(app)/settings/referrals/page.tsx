import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { ReferralShare } from "@/components/settings/referral-share"
import { getCurrentUser } from "@/lib/auth"
import { buildReferralRegistrationUrl, isValidReferralCode } from "@/lib/referral-code"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { getOrCreateWorkshopReferralCode } from "@/lib/workshop-referral"
import styles from "./referrals.module.css"

export const metadata = { title: "Referanslar" }

export default async function ReferralsSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !user.isActive) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }

  const referralCode = await getOrCreateWorkshopReferralCode(user.workshopId)
  const referralUrl = referralCode && isValidReferralCode(referralCode)
    ? buildReferralRegistrationUrl(process.env.APP_URL || "http://localhost:3000", referralCode)
    : null

  return (
    <AppShell pageTitle="Referanslar">
      <div className={styles.content}>
        <header className="border-b border-border pb-5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">BakımX’i paylaşın</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Başka iş yerlerine BakımX’i önerin. Referans kodunuz kayıt sırasında kullanıldığında davet sizin iş yerinizle eşleşir.
          </p>
        </header>

        <section className="pt-8" aria-labelledby="referral-share-heading">
          <h3 id="referral-share-heading" className="text-sm font-semibold text-foreground">Davet bağlantınızı paylaşın</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bağlantıyı açan kişi kayıt formunda referans kodunuzu hazır bulur.
          </p>
          {referralUrl && referralCode ? <ReferralShare referralUrl={referralUrl} referralCode={referralCode} /> : null}
        </section>
      </div>
    </AppShell>
  )
}
