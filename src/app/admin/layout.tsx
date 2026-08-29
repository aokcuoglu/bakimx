import Link from "next/link"
import { cookies } from "next/headers"
import { ChartNoAxesCombined, CircleUserRound, Handshake, ListFilter, ShieldCheck, WalletCards } from "lucide-react"
import { adminCapabilities, can, getAdminContext, isCurrentUserAdmin, ADMIN_ROLE_LABELS } from "@/lib/admin"
import { getSalesAccess } from "@/lib/sales/access"
import { logoutAction } from "@/app/(auth)/login/actions"
import { AdminShell } from "@/components/layout/admin-shell"
import { AdminPageTransition } from "@/app/admin/admin-page-transition"
import { getUnansweredCount } from "@/app/admin/live-chat/data"
import { Button } from "@/components/ui/button"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata = { title: "BakimX Yönetim", robots: PRIVATE_ROBOTS }

// Always render fresh — this is an operational console.
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Real gate for the whole console. Server actions re-assert their own capability
  // (defense in depth — actions do not inherit this guard).
  const hasAdminAccess = await isCurrentUserAdmin()

  // Sales advisors are platform staff, not tenant admins. They intentionally
  // receive a minimal console shell; all non-sales admin pages retain their
  // existing getAdminContext() gates.
  if (!hasAdminAccess) {
    await getSalesAccess()
    return (
      <div className="min-h-screen bg-muted">
        <header className="border-b bg-card">
          <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <Link href="/admin/sales" className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="size-5 text-primary" /> BakimX Satış
            </Link>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/sales"><Handshake className="size-4" /> Bugünüm</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/sales/leads"><ListFilter className="size-4" /> Adaylar</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/sales/performance"><ChartNoAxesCombined className="size-4" /> Performans</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/sales/commissions"><WalletCards className="size-4" /> Hakedişler</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/sales/account"><CircleUserRound className="size-4" /> Hesabım</Link>
              </Button>
              <form action={logoutAction}><Button type="submit" variant="ghost" size="sm">Çıkış</Button></form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><AdminPageTransition>{children}</AdminPageTransition></main>
      </div>
    )
  }

  const ctx = await getAdminContext()

  // Yanıt bekleyen canlı destek görüşmesi sayısı — konsolun her sayfasında
  // görünür ki bekleyen bir ziyaretçi fark edilmeden kalmasın. Sayaç
  // okunamazsa gezinme yine de çizilir (rozet 0 görünür).
  const liveChatUnanswered = can(ctx, "manageLiveChat")
    ? await getUnansweredCount().catch(() => 0)
    : 0

  const cookieStore = await cookies()
  const initialSidebarCollapsed = cookieStore.get("sidebar-state")?.value === "collapsed"

  return (
    <AdminShell
      initialSidebarCollapsed={initialSidebarCollapsed}
      liveChatUnanswered={liveChatUnanswered}
      capabilities={adminCapabilities(ctx)}
      userName={[ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ") || ctx.user.email}
      userRoleLabel={ADMIN_ROLE_LABELS[ctx.adminRole]}
    >
      <AdminPageTransition>{children}</AdminPageTransition>
    </AdminShell>
  )
}
