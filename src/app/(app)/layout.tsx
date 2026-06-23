import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getPlanState, type PlanTier } from "@/lib/plan"
import { PlanLocked } from "@/components/app/plan-locked"
import { AppShellChrome } from "@/components/app/app-shell"

export const metadata: Metadata = {
  title: "İş Yeri Paneli",
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.userId || !session?.workshopId) {
    redirect("/login")
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: session.workshopId },
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
  if (!plan.hasAccess && plan.lockReason) {
    return (
      <PlanLocked
        reason={plan.lockReason}
        workshopName={workshop.name}
        requestedTier={(workshop.requestedPlanTier as PlanTier | null) ?? null}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {plan.isTrialing && plan.trialDaysLeft != null && (
        <div className="bg-primary/10 text-primary text-xs sm:text-sm px-4 py-2 text-center">
          Deneme sürenizin bitmesine{" "}
          <span className="font-semibold">{plan.trialDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">
            Paketi etkinleştir
          </Link>
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
