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
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/admin/workshops", label: "İş Yerleri", icon: Building2 },
  { href: "/admin/billing", label: "Faturalandırma", icon: Receipt },
  { href: "/admin/leads", label: "Talepler", icon: Inbox },
  { href: "/admin/audit", label: "Denetim Kaydı", icon: ScrollText },
  { href: "/admin/health", label: "Sistem Sağlığı", icon: Activity },
]

export function AdminNav() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact)
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
          </Link>
        )
      })}
    </nav>
  )
}
