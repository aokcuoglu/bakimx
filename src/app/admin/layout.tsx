import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { adminCapabilities, can, getAdminContext, ADMIN_ROLE_LABELS } from "@/lib/admin"
import { logoutAction } from "@/app/(auth)/login/actions"
import { AdminNav } from "@/app/admin/admin-nav"
import { getUnansweredCount } from "@/app/admin/live-chat/data"
import { Button } from "@/components/ui/button"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata = { title: "BakimX Yönetim", robots: PRIVATE_ROBOTS }

// Always render fresh — this is an operational console.
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Real gate for the whole console. Server actions re-assert their own capability
  // (defense in depth — actions do not inherit this guard).
  const ctx = await getAdminContext()

  // Yanıt bekleyen canlı destek görüşmesi sayısı — konsolun her sayfasında
  // görünür ki bekleyen bir ziyaretçi fark edilmeden kalmasın. Sayaç
  // okunamazsa gezinme yine de çizilir (rozet 0 görünür).
  const liveChatUnanswered = can(ctx, "manageLiveChat")
    ? await getUnansweredCount().catch(() => 0)
    : 0

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" />
            BakimX Yönetim
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {ADMIN_ROLE_LABELS[ctx.adminRole]}
            </span>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Uygulamaya dön
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Çıkış
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 md:flex md:gap-6">
        <aside className="md:w-52 md:shrink-0">
          <div className="md:sticky md:top-6">
            <AdminNav liveChatUnanswered={liveChatUnanswered} capabilities={adminCapabilities(ctx)} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pt-4 md:pt-0">{children}</main>
      </div>
    </div>
  )
}
