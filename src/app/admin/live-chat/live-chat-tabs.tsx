"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/admin/live-chat", label: "Gelen Kutusu" },
  { href: "/admin/live-chat/settings", label: "Ayarlar" },
]

/** İki canlı destek ekranı arasındaki sekme şeridi. */
export function LiveChatTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
