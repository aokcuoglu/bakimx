"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Car,
  Users,
  ClipboardList,
  Wrench as WrenchIcon,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Plus,
  FileText,
  CalendarClock,
  BellRing,
  Boxes,
  Truck,
  Wallet,
  BarChart3,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Panel",
    items: [{ href: "/app", label: "Genel Bakış", icon: LayoutDashboard }],
  },
  {
    label: "Servis",
    items: [
      { href: "/app/orders", label: "İş Emirleri", icon: WrenchIcon },
      { href: "/app/intakes", label: "Araç Kabulleri", icon: ClipboardList },
      { href: "/app/customers", label: "Müşteriler", icon: Users },
      { href: "/app/vehicles", label: "Araçlar", icon: Car },
      { href: "/app/quotes", label: "Teklifler", icon: FileText },
      { href: "/app/appointments", label: "Randevular", icon: CalendarClock },
      { href: "/app/reminders", label: "Bakım Hatırlatmaları", icon: BellRing },
    ],
  },
  {
    label: "Depo & Finans",
    items: [
      { href: "/app/parts", label: "Stok / Parçalar", icon: Boxes },
      { href: "/app/suppliers", label: "Tedarikçiler", icon: Truck },
      { href: "/app/cashbox", label: "Kasa", icon: Wallet },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/app/reports", label: "Raporlar", icon: BarChart3, badge: "Yakında" },
    ],
  },
  {
    label: "Ayarlar",
    items: [{ href: "/app/workshop", label: "İş Yeri Profili", icon: Settings }],
  },
]

const COMING_SOON_PREFIXES = ["/app/reports"]

function isComingSoon(pathname: string): boolean {
  return COMING_SOON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function AppShell({
  children,
  workshopName,
  pageTitle,
  pageActions,
  showGlobalSearch = true,
}: {
  children: React.ReactNode
  workshopName?: string
  pageTitle?: string
  pageActions?: React.ReactNode
  showGlobalSearch?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = searchValue.trim()
    if (!value) return
    router.push(`/app/parts?q=${encodeURIComponent(value)}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0F172A] text-slate-100 border-r border-slate-800">
          <SidebarContent pathname={pathname} workshopName={workshopName} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-72 bg-[#0F172A] text-slate-100 shadow-xl flex flex-col">
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-slate-300 hover:text-white p-1.5 rounded-md hover:bg-white/10 touch-manipulation"
                  aria-label="Menüyü kapat"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent pathname={pathname} workshopName={workshopName} onClose={() => setSidebarOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 lg:pl-64 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100 text-slate-700 touch-manipulation"
                aria-label="Menüyü aç"
              >
                <Menu className="size-5" />
              </button>

              {pageTitle && (
                <div className="hidden sm:flex flex-col min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{pageTitle}</h1>
                </div>
              )}

              {showGlobalSearch && (
                <form onSubmit={handleSearch} className="flex-1 sm:max-w-md sm:mx-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="search"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Plaka, müşteri, iş emri ara"
                      className="w-full h-9 sm:h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                </form>
              )}

              {!showGlobalSearch && <div className="flex-1" />}

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/app/orders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
                >
                  <Plus className="size-4" />
                  <span>Yeni İş Emri</span>
                </Link>
                <Link
                  href="/app/quotes/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors touch-manipulation"
                >
                  <FileText className="size-4" />
                  <span>Yeni Teklif</span>
                </Link>
                <Link
                  href="/app/appointments/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors touch-manipulation"
                >
                  <CalendarClock className="size-4" />
                  <span>Yeni Randevu</span>
                </Link>
                <Link
                  href="/app/reminders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors touch-manipulation"
                >
                  <BellRing className="size-4" />
                  <span>Yeni Hatırlatma</span>
                </Link>
                <Link
                  href="/app/orders/new"
                  className="sm:hidden inline-flex items-center justify-center size-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
                  aria-label="Yeni iş emri"
                >
                  <Plus className="size-4" />
                </Link>
                <button
                  type="button"
                  className="relative inline-flex items-center justify-center size-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors touch-manipulation"
                  aria-label="Bildirimler"
                  title="Bildirimler (yakında)"
                >
                  <Bell className="size-5" />
                </button>
                <UserMenu />
              </div>
            </div>
            {(pageTitle || pageActions) && (
              <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3 -mt-1">
                {pageTitle && <h1 className="text-base font-semibold text-slate-900 truncate">{pageTitle}</h1>}
                {pageActions}
              </div>
            )}
          </header>

          <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          <MobileNavLink href="/app" label="Panel" icon={LayoutDashboard} active={pathname === "/app"} />
          <MobileNavLink
            href="/app/orders"
            label="İş Emirleri"
            icon={WrenchIcon}
            active={pathname === "/app/orders" || pathname.startsWith("/app/orders/")}
          />
          <MobileNavLink
            href="/app/intakes"
            label="Kabuller"
            icon={ClipboardList}
            active={pathname === "/app/intakes" || pathname.startsWith("/app/intakes/")}
          />
          <MobileNavLink
            href="/app/customers"
            label="Müşteriler"
            icon={Users}
            active={pathname.startsWith("/app/customers") || pathname.startsWith("/app/vehicles")}
          />
        </div>
      </nav>
    </div>
  )
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded-lg transition-colors touch-manipulation",
        active ? "text-blue-600 font-medium" : "text-slate-500 hover:text-slate-700"
      )}
    >
      <Icon className="size-5" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function UserMenu() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="inline-flex items-center justify-center size-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors touch-manipulation"
        aria-label="Çıkış Yap"
        title="Çıkış Yap"
      >
        <LogOut className="size-4" />
      </button>
    </form>
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
      <div className="px-5 py-5 border-b border-slate-800/80">
        <Link
          href="/app"
          onClick={onClose}
          className="flex items-center gap-2.5 group"
        >
          <div className="size-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
            B
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white leading-tight truncate">
              {workshopName || "BakimX"}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Servis Yönetimi</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const isSoon = isComingSoon(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-blue-600/20 text-white border border-blue-500/30"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                      isSoon && !isActive && "opacity-60"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="size-3.5 text-blue-300" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800/80">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors w-full touch-manipulation"
          >
            <LogOut className="size-4" />
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  )
}

export { COMING_SOON_PREFIXES }
