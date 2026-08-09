import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getActiveImpersonation } from "@/lib/session"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPlanState, isPlanExpiredLock } from "@/lib/plan"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { PlanLocked } from "@/components/billing/plan-locked"
import { AppShellChrome } from "@/components/layout/app-shell"
import { ImpersonationBanner } from "@/components/layout/impersonation-banner"
import { VersionUpdateNotice } from "@/components/layout/version-update-notice"
import { getBuildSignature } from "@/lib/build-signature"

export const metadata: Metadata = {
  title: "İş Yeri Paneli",
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Effective identity — under impersonation this resolves to the target tenant.
  // Oturum çerezi geçerli imzalı olduğu hâlde karşılığı çözülemiyorsa (silinmiş
  // kullanıcı, yerelde yeniden seed, elle veri işlemi) düz `/login` yönlendirmesi
  // SONSUZ DÖNGÜ yapar: middleware çerezi görüp bizi /dashboard'a geri yollar.
  // `reason` parametresi middleware'e çerezi imha etmesini söyler.
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
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
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }

  const plan = getPlanState(workshop)

  // Paywall: deneme/abonelik süresi bitmiş bir oturum uygulamayı hiç göremez.
  // Login'e atıyoruz; `?expired=` gören middleware oturum cookie'sini siler
  // (Server Component'te cookie yazılamaz) ve girişten sonra kullanıcı /checkout'a
  // düşer (bkz. lib/auth-login.ts + api/auth/login/route.ts).
  // İSTİSNA — impersonation: bu yönlendirme KURUCUNUN oturumunu kapatırdı, o yüzden
  // kilitli tenant'ı incelerken aşağıdaki salt-okunur mod korunur.
  if (isPlanExpiredLock(plan.lockReason) && !impersonation) {
    redirect(`/login?expired=${plan.lockReason}`)
  }

  const cookieStore = await cookies()
  const initialSidebarCollapsed = cookieStore.get("sidebar-state")?.value === "collapsed"

  // Full-screen lock: only the approval gate (pending/rejected) blocks the whole
  // app now. Plan-expiry reasons drop to read-only mode below (data visible,
  // writes blocked server-side, persistent banner). Keep the impersonation
  // banner so the founder can always exit.
  if (!plan.hasAccess && (plan.lockReason === "pending" || plan.lockReason === "rejected")) {
    const pendingOrder = await prisma.billingOrder.findFirst({
      where: { workshopId: user.workshopId, status: "pending_payment" },
      select: { id: true },
    })
    return (
      <>
        {impersonation && <ImpersonationBanner workshopName={workshop.name} />}
        <PlanLocked
          reason={plan.lockReason}
          workshopName={workshop.name}
          hasPendingOrder={!!pendingOrder}
        />
      </>
    )
  }

  // Salt-okunur bant: buraya artık yalnızca kurucu impersonation'ı düşebilir —
  // gerçek kullanıcı yukarıda çıkışa yönlendirildi. Kurucu kilitli tenant'ı
  // inceleyebilsin diye veri görünür kalır; yazma işlemleri sunucu tarafında
  // (requireWritableWorkshop / assertWriteAccess) zaten bloklu.
  const readOnlyLocked = !plan.canWrite
  const readOnlyMessage =
    plan.lockReason === "trial_expired"
      ? "Bu iş yerinin deneme süresi doldu — plan kilidi nedeniyle salt-okunur."
      : "Bu iş yerinin aboneliği sona erdi — plan kilidi nedeniyle salt-okunur."

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Bu belgeyi render eden build'in imzası — açık sekme eskidiğinde
          engellemeyen "yenile" bildirimi için (bkz. version-update-notice.tsx). */}
      <VersionUpdateNotice loadedSignature={getBuildSignature()} />
      {impersonation && <ImpersonationBanner workshopName={workshop.name} />}
      {readOnlyLocked && (
        <div className="bg-destructive text-destructive-foreground text-xs sm:text-sm px-4 py-2 text-center">
          {readOnlyMessage}
        </div>
      )}
      {!readOnlyLocked && plan.isTrialing && plan.trialDaysLeft != null && (
        <div className="bg-primary/10 text-primary text-xs sm:text-sm px-4 py-2 text-center">
          Deneme sürenizin bitmesine{" "}
          <span className="font-semibold">{plan.trialDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">
            Paketi etkinleştir
          </Link>
        </div>
      )}
      {!readOnlyLocked && !plan.isTrialing && plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7 && (
        <div className="bg-amber-100 text-amber-800 text-xs sm:text-sm px-4 py-2 text-center">
          Aboneliğinizin bitmesine{" "}
          <span className="font-semibold">{plan.subscriptionDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">Yenile</Link>
        </div>
      )}
      <div className="flex-1">
        <AppShellChrome initialSidebarCollapsed={initialSidebarCollapsed}>{children}</AppShellChrome>
      </div>
      <div className="border-t py-3 px-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BakimX · Tüm hakları saklıdır · v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>
    </div>
  )
}
