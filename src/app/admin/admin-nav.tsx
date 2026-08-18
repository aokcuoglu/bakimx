"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Inbox,
  ScrollText,
  Activity,
  ToggleLeft,
  PackageSearch,
  MessagesSquare,
  ShieldUser,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdminCapability } from "@/lib/admin-roles"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  /** Yanıt bekleyen görüşme sayısı gibi sayaçlar için anahtar. */
  badgeKey?: "liveChat"
  /**
   * Bu yetki yoksa bağlantı hiç çizilmez. Sayfa zaten kendi kapısında 404
   * veriyor; bu yalnız UX — yetkisi olmayan bir role tıklayınca 404 alacağı
   * bağlantı gösterilmesin (BAK-93 ile roller gerçek oldu).
   */
  capability?: AdminCapability
}

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/admin/workshops", label: "İş Yerleri", icon: Building2 },
  { href: "/admin/billing", label: "Faturalandırma", icon: Receipt },
  { href: "/admin/leads", label: "Talepler", icon: Inbox },
  {
    href: "/admin/live-chat",
    label: "Canlı Destek",
    icon: MessagesSquare,
    badgeKey: "liveChat",
    capability: "manageLiveChat",
  },
  { href: "/admin/catalog", label: "Ürün Kataloğu", icon: PackageSearch, capability: "manageCatalog" },
  { href: "/admin/flags", label: "Özellik Bayrakları", icon: ToggleLeft, capability: "manageFlags" },
  { href: "/admin/audit", label: "Denetim Kaydı", icon: ScrollText, capability: "viewAudit" },
  { href: "/admin/health", label: "Sistem Sağlığı", icon: Activity, capability: "viewHealth" },
  { href: "/admin/admins", label: "Yöneticiler", icon: ShieldUser, capability: "manageAdmins" },
]

export function AdminNav({
  liveChatUnanswered = 0,
  capabilities = [],
}: {
  liveChatUnanswered?: number
  capabilities?: AdminCapability[]
}) {
  const pathname = usePathname()
  const allowed = new Set(capabilities)
  const items = ITEMS.filter((i) => !i.capability || allowed.has(i.capability))

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const badgeCount = (key: NavItem["badgeKey"]) => (key === "liveChat" ? liveChatUnanswered : 0)

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map(({ href, label, icon: Icon, exact, badgeKey }) => {
        const active = isActive(href, exact)
        const count = badgeCount(badgeKey)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
            {count > 0 && (
              <span
                className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
                aria-label={`${count} yanıtlanmamış görüşme`}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
