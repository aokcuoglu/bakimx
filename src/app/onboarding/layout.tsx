import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { BrandLogo } from "@/components/shared/brand-logo"
import { RegisterForm } from "@/components/auth/register-form"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FIRST_ONBOARDING_PATH } from "@/lib/onboarding-steps"
import { getPlanState, isPlanExpiredLock } from "@/lib/plan"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { isOnboardingPending } from "@/lib/validations/onboarding"

export const metadata: Metadata = {
  title: "Servisinizi hazırlayın",
  robots: { index: false, follow: false },
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || !user.isActive) redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  if (user.role !== "owner" || user.impersonatorAdminId) redirect("/dashboard")

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: {
      name: true,
      kind: true,
      onboardingProfile: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      liteFreeGrantedAt: true,
      currentPeriodEnd: true,
      requestedPlanTier: true,
    },
  })
  if (!workshop) redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  if (workshop.kind === "internal") redirect("/admin/sales")
  if (!isOnboardingPending(workshop.onboardingProfile)) redirect("/dashboard")

  // Preserve the app's plan and temporary-password gates before exposing setup.
  const plan = getPlanState(workshop)
  if (isPlanExpiredLock(plan.lockReason)) redirect(`/login?expired=${plan.lockReason}`)
  if (!plan.hasAccess || user.mustChangePassword) redirect("/dashboard")

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-7 sm:py-9">
        <Link href={FIRST_ONBOARDING_PATH} aria-label="BakımX kurulum başlangıcı" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <BrandLogo variant="icon-light" size="md" priority alt="" />
          BakımX
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-3 pb-8 sm:px-6">
        <div className="grid w-full min-h-[min(660px,calc(100dvh-160px))] overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-2">
          <section aria-label="Kurulum formu" className="flex min-h-[560px] min-w-0 flex-col px-5 py-7 sm:px-10 sm:py-9 lg:max-h-[min(740px,calc(100dvh-160px))]">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{workshop.name}</p>
            <p className="mb-5 text-xs text-muted-foreground">Servisinizi birkaç adımda hazırlayalım.</p>
            <RegisterForm mode="onboarding" draftKey={`onboarding:${user.workshopId}`} />
          </section>
          <aside aria-label="BakımX önizlemesi" className="hidden min-w-0 items-center justify-center overflow-hidden border-l border-border bg-muted/30 px-8 py-10 lg:flex">
            {children}
          </aside>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 pb-5 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} BakımX</span>
        <Link href="/kvkk" target="_blank" className="hover:text-foreground hover:underline">KVKK</Link>
        <Link href="/privacy" target="_blank" className="hover:text-foreground hover:underline">Gizlilik</Link>
        <Link href="/terms" target="_blank" className="hover:text-foreground hover:underline">Kullanım Koşulları</Link>
      </footer>
    </div>
  )
}
