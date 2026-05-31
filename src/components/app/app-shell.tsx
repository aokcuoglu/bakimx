"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Car,
  Users,
  ClipboardList,
  Wrench,
  Settings,
  LogOut,
  Menu,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/app", label: "Panel", icon: LayoutDashboard },
  { href: "/app/intakes", label: "Kabuller", icon: ClipboardList },
  { href: "/app/customers", label: "Müşteriler", icon: Users },
  { href: "/app/vehicles", label: "Araçlar", icon: Car },
  { href: "/app/orders", label: "Siparişler", icon: Wrench },
  { href: "/app/workshop", label: "İş Yeri", icon: Settings },
]

export function AppShell({ children, workshopName }: { children: React.ReactNode; workshopName?: string }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-navy text-navy-foreground">
        <SidebarContent pathname={pathname} workshopName={workshopName} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-navy text-navy-foreground">
            <SidebarContent pathname={pathname} workshopName={workshopName} onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-64">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 bg-navy text-navy-foreground px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="size-6" />
          </button>
          <span className="font-semibold text-sm">{workshopName || "BakimX"}</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <div className="flex justify-around items-center py-2">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 text-xs px-2 py-1",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <Link
            href="/app"
            className={cn(
              "flex flex-col items-center gap-0.5 text-xs px-2 py-1",
              pathname === "/app" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="size-5" />
            <span>Panel</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

function SidebarContent({
  pathname,
  workshopName,
  onClose,
}: {
  pathname: string
  workshopName?: string
  onClose?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold">{workshopName || "BakimX"}</h1>
        <p className="text-xs text-white/60 mt-0.5">Araç Kabul Sistemi</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut className="size-5" />
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  )
}