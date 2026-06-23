"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Wrench,
  Users,
  Wallet,
  Boxes,
  HardHat,
  BarChart3,
} from "lucide-react"

const REPORT_NAV = [
  { href: "/reports/orders", label: "İş Emirleri", icon: Wrench },
  { href: "/reports/customers", label: "Müşteriler", icon: Users },
  { href: "/reports/collections", label: "Tahsilatlar", icon: Wallet },
  { href: "/reports/parts", label: "Parçalar", icon: Boxes },
  { href: "/reports/technicians", label: "Teknisyenler", icon: HardHat },
]

export function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Raporlar</h2>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-border scrollbar-hide">
        {REPORT_NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}