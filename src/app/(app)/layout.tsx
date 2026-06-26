import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getActiveImpersonation } from "@/lib/session"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPlanState } from "@/lib/plan"
import { PlanLocked } from "@/components/app/plan-locked"
import { AppShellChrome } from "@/components/app/app-shell"
import { ImpersonationBanner } from "@/components/app/impersonation-banner"

export const metadata: Metadata = {
  title: "İş Yeri Paneli",
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Effective identity — under impersonation this resolves to the target tenant.
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  const impersonation = await getActiveImpersonation()

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: {
      name: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      requestedPlanTier: true,
    },
  })
  if (!workshop) {
    redirect("/login")
  }

  const plan = getPlanState(workshop)

  // Access gate: trial expired / subscription inactive → locked upgrade screen.
  // Keep the impersonation banner so the founder can always exit.
  if (!plan.hasAccess && plan.lockReason) {
    return (
      <>
        {impersonation && <ImpersonationBanner workshopName={workshop.name} />}
        <PlanLocked reason={plan.lockReason} workshopName={workshop.name} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {impersonation && <ImpersonationBanner workshopName={workshop.name} />}
      {plan.isTrialing && plan.trialDaysLeft != null && (
        <div className="bg-primary/10 text-primary text-xs sm:text-sm px-4 py-2 text-center">
          Deneme sürenizin bitmesine{" "}
          <span className="font-semibold">{plan.trialDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">
            Paketi etkinleştir
          </Link>
        </div>
      )}
      {!plan.isTrialing && plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7 && (
        <div className="bg-amber-100 text-amber-800 text-xs sm:text-sm px-4 py-2 text-center">
          Aboneliğinizin bitmesine{" "}
          <span className="font-semibold">{plan.subscriptionDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">Yenile</Link>
        </div>
      )}
      <div className="flex-1">
        <AppShellChrome>{children}</AppShellChrome>
      </div>
      <div className="border-t py-3 px-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BakimX · Tüm hakları saklıdır · v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>
    </div>
  )
}
