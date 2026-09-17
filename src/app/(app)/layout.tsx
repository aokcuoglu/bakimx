import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GATED_FEATURES, getPlanState, hasFeature, isPlanExpiredLock } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getSidebarPlanStatus } from "@/lib/billing/sidebar-plan-status"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { PlanLocked } from "@/components/billing/plan-locked"
import { ForcePasswordChange } from "@/components/auth/force-password-change"
import { AppShellChrome } from "@/components/layout/app-shell"
import { ImpersonationBanner } from "@/components/layout/impersonation-banner"
import { VersionUpdateNotice } from "@/components/layout/version-update-notice"
import { getBuildSignature } from "@/lib/build-signature"
import { FIRST_ONBOARDING_PATH } from "@/lib/onboarding-steps"
import { isOnboardingCompleted, isOnboardingPending } from "@/lib/validations/onboarding"
import { canCreateBranch, listUserMemberships } from "@/lib/membership"
import { PRIVATE_ROBOTS, TITLE_TEMPLATE } from "@/lib/seo"

export const metadata: Metadata = {
  title: { default: "İş Yeri Paneli", template: TITLE_TEMPLATE },
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
  robots: PRIVATE_ROBOTS,
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Effective identity — under impersonation this resolves to the target tenant.
  // Oturum çerezi geçerli imzalı olduğu hâlde karşılığı çözülemiyorsa (silinmiş
  // kullanıcı, yerelde yeniden seed, elle veri işlemi) düz `/login` yönlendirmesi
  // SONSUZ DÖNGÜ yapar: middleware çerezi görüp bizi /dashboard'a geri yollar.
  // `reason` parametresi middleware'e çerezi imha etmesini söyler.
  const user = await getCurrentUser()
  if (!user || !user.isActive) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }
  // BAK-96 — ayrı bir çağrı YOK: etkin kimlik zaten overlay'den çözüldü ve orada
  // iptal kontrolü yapıldı. Buradan tekrar sormak hem ikinci bir DB isteği hem de
  // iptalden habersiz (çerez-only) ikinci bir doğruluk kaynağı olurdu.
  const impersonation = Boolean(user.impersonatorAdminId)

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: {
      id: true,
      name: true,
      city: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      liteFreeGrantedAt: true,
      currentPeriodEnd: true,
      requestedPlanTier: true,
      kind: true,
      onboardingProfile: true,
    },
  })
  if (!workshop) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }
  if (workshop.kind === "internal") {
    redirect("/admin/sales")
  }

  const plan = getPlanState(workshop)
  const isTechnicianRole = isTechnicianRestrictedRole(user.role)
  const sidebarPlanStatus = isTechnicianRole
    ? null
    : getSidebarPlanStatus(plan, getPlanPackage(plan.tier)?.name ?? plan.tier)

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

  // Kapısı olan menü satırları için (BAK-60: BakımX Siparişleri). Kapı SUNUCUDA
  // çözülür; istemciye yalnız "açık olanlar" listesi iner, kapının nasıl
  // hesaplandığı değil.
  const enabledFeatures = GATED_FEATURES.filter((feature) => hasFeature(plan.accessTier, feature))

  const membershipRows = await listUserMemberships(user.id)
  const workspaceMemberships =
    membershipRows.length > 0
      ? membershipRows.map((row) => ({ ...row.workshop, role: row.role }))
      : [
          {
            id: workshop.id,
            name: workshop.name,
            city: workshop.city,
            loginCode: "",
            organizationId: null,
            planTier: workshop.planTier,
            logoUrl: null,
            role: user.role,
          },
        ]
  const workspaceSwitcher = {
    currentWorkshopId: user.workshopId,
    memberships: workspaceMemberships,
    canCreateBranch: canCreateBranch({ ...workshop, role: user.role }),
  }

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

  // Geçici şifre kapısı (BAK-37). Plan kilidinden SONRA gelir — sıralama
  // `requireWritableWorkshop` ile aynı: önce plan, sonra şifre. Kapı burada tek
  // bir yerde durur (plan kilidi kalıbı), tek tek sayfalara serpiştirilmez.
  // Kurucu impersonation'ı muaf: kilitli hesabı inceleyen kurucudan başkasının
  // şifresini belirlemesi istenemez.
  if (user.mustChangePassword && !impersonation) {
    return (
      <ForcePasswordChange
        displayName={[user.firstName, user.lastName].filter(Boolean).join(" ")}
      />
    )
  }

  const requiresOnboarding = user.role === "owner" && !impersonation &&
    isOnboardingPending(workshop.onboardingProfile)
  if (requiresOnboarding) redirect(FIRST_ONBOARDING_PATH)

  // Post-wizard product tour: owners who finished onboarding and have not dismissed it yet.
  const showDashboardTour =
    user.role === "owner" &&
    !impersonation &&
    !user.dashboardTourCompletedAt &&
    isOnboardingCompleted(workshop.onboardingProfile)

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
        <div className={`bg-primary/10 text-primary-strong text-xs sm:text-sm px-4 py-2 text-center ${isTechnicianRole ? "" : "lg:hidden"}`}>
          Deneme sürenizin bitmesine{" "}
          <span className="font-semibold">{plan.trialDaysLeft} iş günü</span> kaldı.{" "}
          {!isTechnicianRole && <Link href="/settings/plans" className="font-semibold underline underline-offset-2">Paketleri incele</Link>}
        </div>
      )}
      {!readOnlyLocked && !plan.isTrialing && plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7 && (
        <div className={`bg-warning/10 text-warning-strong text-xs sm:text-sm px-4 py-2 text-center ${isTechnicianRole ? "" : "lg:hidden"}`}>
          Aboneliğinizin bitmesine{" "}
          <span className="font-semibold">{plan.subscriptionDaysLeft} gün</span> kaldı.{" "}
          {!isTechnicianRole && <Link href="/settings/billing" className="font-semibold underline underline-offset-2">Paketi yönet</Link>}
        </div>
      )}
      <div className="flex-1">
        <AppShellChrome
          initialSidebarCollapsed={initialSidebarCollapsed}
          enabledFeatures={enabledFeatures}
          showDashboardTour={showDashboardTour}
          planStatus={sidebarPlanStatus}
          workspace={workspaceSwitcher}
          userIdentity={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            username: user.username,
            role: user.role,
          }}
        >
          {children}
        </AppShellChrome>
      </div>
      <div className="border-t py-3 px-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BakimX · Tüm hakları saklıdır · v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>
    </div>
  )
}
