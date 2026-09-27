import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { ReferralShare } from "@/components/settings/referral-share"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildReferralRegistrationUrl, isValidReferralCode } from "@/lib/referral-code"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"

export const metadata = { title: "Referanslar" }

export default async function ReferralsSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !user.isActive) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { referralCode: true },
  })
  const referralCode = workshop?.referralCode
  const referralUrl = referralCode && isValidReferralCode(referralCode)
    ? buildReferralRegistrationUrl(process.env.APP_URL || "http://localhost:3000", referralCode)
    : null

  return (
    <AppShell pageTitle="Referanslar">
      <div className="mx-auto w-full max-w-3xl pt-6 sm:pt-12">
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
          {referralUrl ? (
            <ReferralShare referralUrl={referralUrl} referralCode={referralCode!} />
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Paylaşılabilir bağlantı için önce iş yeri ayarlarında bir referans kodu oluşturun.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/settings/general">Referans kodu oluştur</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
