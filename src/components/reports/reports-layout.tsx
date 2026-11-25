"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Wrench,
  Users,
  Wallet,
  Boxes,
  HardHat,
  BarChart3,
} from "lucide-react"

const REPORT_NAV = [
  { href: "/reports/orders", label: "Araç Kabulleri", icon: Wrench },
  { href: "/reports/customers", label: "Müşteriler", icon: Users },
  { href: "/reports/collections", label: "Tahsilatlar", icon: Wallet },
  { href: "/reports/parts", label: "Parçalar", icon: Boxes },
  { href: "/reports/technicians", label: "Teknisyenler", icon: HardHat },
]

export function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {pathname !== "/reports" && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Raporlar</h2>
          </div>
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-border scrollbar-hide">
        {REPORT_NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              variant={isActive ? "foreground" : "secondary"}
              size="sm"
              className={cn(
                "whitespace-nowrap",
                !isActive && "text-muted-foreground hover:text-foreground"
              )}
              asChild
            >
              <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
