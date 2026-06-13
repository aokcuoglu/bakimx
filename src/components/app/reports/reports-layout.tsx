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
  { href: "/app/reports/orders", label: "İş Emirleri", icon: Wrench },
  { href: "/app/reports/customers", label: "Müşteriler", icon: Users },
  { href: "/app/reports/collections", label: "Tahsilatlar", icon: Wallet },
  { href: "/app/reports/parts", label: "Parçalar", icon: Boxes },
  { href: "/app/reports/technicians", label: "Teknisyenler", icon: HardHat },
]

export function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Raporlar</h2>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-slate-200 scrollbar-hide">
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
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
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