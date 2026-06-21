"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/shared/brand-logo"
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
  ChevronDown,
  ChevronLeft,
  ScanLine,
  HardHat,
  Activity,
  MessageSquare,
  Calendar,
  Receipt,
} from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
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
      { href: "/app/technician", label: "Teknisyen Paneli", icon: HardHat },
      { href: "/app/customers", label: "Müşteriler", icon: Users },
      { href: "/app/vehicles", label: "Araçlar", icon: Car },
      { href: "/app/quotes", label: "Teklifler", icon: FileText },
      { href: "/app/appointments", label: "Randevular", icon: CalendarClock },
      { href: "/app/calendar", label: "Takvim", icon: Calendar },
      { href: "/app/reminders", label: "Bakım Hatırlatmaları", icon: BellRing },
      { href: "/app/smart-capture/registration", label: "Ruhsat Okuma", icon: ScanLine },
    ],
  },
  {
    label: "Depo & Finans",
    items: [
      { href: "/app/parts", label: "Stok / Parçalar", icon: Boxes },
      { href: "/app/suppliers", label: "Tedarikçiler", icon: Truck },
      { href: "/app/cashbox", label: "Kasa", icon: Wallet, children: [
        { href: "/app/cashbox/payments", label: "Tahsilatlar", icon: Receipt },
        { href: "/app/cashbox/aging", label: "Yaşlandırma", icon: BarChart3 },
      ] },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/app/analytics", label: "Operasyonel Analiz", icon: Activity },
      { href: "/app/reports", label: "Raporlar", icon: BarChart3 },
    ],
  },
  {
    label: "İletişim",
    items: [
      { href: "/app/communications", label: "İletişim Kayıtları", icon: MessageSquare },
    ],
  },
  {
    label: "Ayarlar",
    items: [
      { href: "/app/settings?tab=profile", label: "Ayarlar", icon: Settings },
      { href: "/app/settings/notifications", label: "Bildirim Ayarları", icon: Bell },
      { href: "/app/settings/calendar", label: "Takvim Ayarları", icon: Calendar },
    ],
  },
]

const COMING_SOON_PREFIXES: string[] = []

function isComingSoon(pathname: string): boolean {
  return COMING_SOON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Persisted sidebar collapse state backed by localStorage, exposed as an
// external store so it can be read with useSyncExternalStore. This restores the
// saved state without a setState-in-effect and without an SSR hydration
// mismatch (the server snapshot is always "expanded").
const SIDEBAR_STORAGE_KEY = "sidebar-state"
const sidebarStoreListeners = new Set<() => void>()

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed"
  } catch {
    return false
  }
}

function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded")
  } catch {
    // localStorage erişilemezse sessizce geç
  }
  sidebarStoreListeners.forEach((listener) => listener())
}

function subscribeSidebarStore(listener: () => void): () => void {
  sidebarStoreListeners.add(listener)
  return () => {
    sidebarStoreListeners.delete(listener)
  }
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
  // Server snapshot is always "expanded" (false); the persisted value is applied
  // after hydration without a mismatch warning.
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarStore,
    readSidebarCollapsed,
    () => false
  )
  const [searchValue, setSearchValue] = useState("")

  function toggleSidebar() {
    writeSidebarCollapsed(!sidebarCollapsed)
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = searchValue.trim()
    if (!value) return
    router.push(`/app/parts?q=${encodeURIComponent(value)}`)
  }

  const desktopSidebarWidth = sidebarCollapsed ? "lg:w-16" : "lg:w-64"
  const desktopContentPadding = sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"

  return (
    <div className="min-h-screen bg-muted">
      <div className="flex">
        <aside
          className={cn(
            "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-navy-light text-navy-foreground border-r border-navy-foreground/10 transition-[width] duration-200 ease-in-out",
            desktopSidebarWidth,
          )}
        >
          <SidebarContent
            pathname={pathname}
            workshopName={workshopName}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 bg-navy-light text-navy-foreground border-r border-navy-foreground/10 p-0 flex flex-col" showCloseButton={false}>
            <div className="flex justify-end p-3">
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground/50 hover:text-navy-foreground p-1.5 rounded-md hover:bg-navy-foreground/10 touch-manipulation"
                aria-label="Menüyü kapat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent pathname={pathname} workshopName={workshopName} onClose={() => setSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className={cn("flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-[padding] duration-200 ease-in-out", desktopContentPadding)}>
          <header className="sticky top-0 z-30 bg-white border-b border-border">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted text-foreground touch-manipulation"
                aria-label="Menüyü aç"
              >
                <Menu className="size-5" />
              </button>

              {pageTitle && (
                <div className="hidden sm:flex flex-col min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{pageTitle}</h1>
                </div>
              )}

              {showGlobalSearch && (
                <form onSubmit={handleSearch} className="flex-1 sm:max-w-md sm:mx-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                    <Input
                      type="search"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Plaka, müşteri, iş emri ara"
                      className="h-9 sm:h-10 pl-9"
                    />
                  </div>
                </form>
              )}

              {!showGlobalSearch && <div className="flex-1" />}

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/app/orders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <Plus className="size-4" />
                  <span>Yeni İş Emri</span>
                </Link>
                <Link
                  href="/app/quotes/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <FileText className="size-4" />
                  <span>Yeni Teklif</span>
                </Link>
                <Link
                  href="/app/appointments/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <CalendarClock className="size-4" />
                  <span>Yeni Randevu</span>
                </Link>
                <Link
                  href="/app/reminders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <BellRing className="size-4" />
                  <span>Yeni Hatırlatma</span>
                </Link>
                <Link
                  href="/app/orders/new"
                  className="sm:hidden inline-flex items-center justify-center size-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation"
                  aria-label="Yeni iş emri"
                >
                  <Plus className="size-4" />
                </Link>
                <Tooltip>
                  <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="Bildirimler" />}>
                    <Bell className="size-5" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Bildirimler (yakında)</TooltipContent>
                </Tooltip>
                <UserMenu />
              </div>
            </div>
            {(pageTitle || pageActions) && (
              <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3 -mt-1">
                {pageTitle && <h1 className="text-base font-semibold text-foreground truncate">{pageTitle}</h1>}
                {pageActions}
              </div>
            )}
          </header>

          <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8">{children}</main>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border safe-area-bottom">
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5">
          <MobileNavLink href="/app" label="Panel" icon={LayoutDashboard} active={pathname === "/app"} />
          <MobileNavLink
            href="/app/orders"
            label="İş Emirleri"
            icon={WrenchIcon}
            active={pathname === "/app/orders" || pathname.startsWith("/app/orders/")}
          />
          <MobileNavLink
            href="/app/technician"
            label="Teknisyen"
            icon={HardHat}
            active={pathname === "/app/technician" || pathname.startsWith("/app/technician/")}
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
        active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
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
      <Tooltip>
        <TooltipTrigger render={<Button type="submit" variant="ghost" size="icon" aria-label="Çıkış Yap" />}>
          <LogOut className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">Çıkış Yap</TooltipContent>
      </Tooltip>
    </form>
  )
}

function SidebarContent({
  pathname,
  workshopName,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  pathname: string
  workshopName?: string
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children) {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            || item.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
          if (isActive) initial.add(item.href)
        }
      }
    }
    return initial
  })

  function toggleExpanded(href: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn("py-5 border-b border-navy-foreground/10", collapsed ? "px-2" : "px-5")}>
        <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between gap-2"}>
          <Tooltip>
            <TooltipTrigger render={<Link href="/app" onClick={onClose} aria-label="BakimX" className="flex items-center group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-deep">
              {collapsed ? (
                <BrandLogo variant="icon-dark" size="md" alt="BakimX" />
              ) : (
                <BrandLogo variant="icon-dark" size="md" priority alt="BakimX" />
              )}
              <span className="sr-only">BakimX</span>
            </Link>} />
            <TooltipContent side="right">BakimX</TooltipContent>
          </Tooltip>
          {onToggleCollapse && (
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={onToggleCollapse} aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"} />}>
                {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </TooltipTrigger>
              <TooltipContent side="top">{collapsed ? "Menüyü genişlet" : "Menüyü daralt"}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {workshopName && !collapsed && (
          <p className="mt-2 text-[11px] text-muted-foreground/70 truncate">{workshopName}</p>
        )}
      </div>

      <nav className={cn("flex-1 py-4 space-y-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const hasChildren = item.children && item.children.length > 0
                const isParentActive =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const isAnyChildActive = hasChildren
                  ? item.children!.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
                  : false
                const isActive = hasChildren ? isAnyChildActive : isParentActive
                const isExpanded = expandedKeys.has(item.href)
                const isSoon = isComingSoon(item.href)

                if (collapsed) {
                  return (
                    <div key={item.href} className="relative group/collapsed">
                      <Tooltip>
                        <TooltipTrigger render={<Link href={item.href} onClick={onClose} aria-label={item.label} className={cn(
                          "flex items-center justify-center size-9 rounded-lg transition-all mx-auto",
                          isActive
                            ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                            : "text-muted-foreground/50 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}>
                          <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground/70 group-hover/collapsed:text-navy-foreground/90")} />
                        </Link>} />
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    </div>
                  )
                }

                return (
                  <div key={item.href}>
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpanded(item.href)}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full text-left",
                          isActive
                            ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                            : "text-muted-foreground/50 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground/70 group-hover:text-navy-foreground/90")} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isExpanded
                          ? <ChevronDown className="size-3.5 text-muted-foreground/70" />
                          : <ChevronRight className="size-3.5 text-muted-foreground/70" />}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                            : "text-muted-foreground/50 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground/70 group-hover:text-navy-foreground/90")} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-navy-foreground/5 text-muted-foreground/70">
                            {item.badge}
                          </span>
                        )}
                        {isActive && <ChevronRight className="size-3.5 text-primary" />}
                      </Link>
                    )}

                    {hasChildren && isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                            pathname === item.href
                              ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                              : "text-muted-foreground/70 hover:bg-navy-foreground/5 hover:text-navy-foreground"
                          )}
                        >
                          <Icon className={cn("size-3.5 shrink-0", pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-muted-foreground/50")} />
                          <span className="flex-1 truncate">{item.label} Özeti</span>
                          {pathname === item.href && <ChevronRight className="size-3 text-primary" />}
                        </Link>
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon
                          const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onClose}
                              className={cn(
                                "group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                                isChildActive
                                  ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                                  : "text-muted-foreground/70 hover:bg-navy-foreground/5 hover:text-navy-foreground"
                              )}
                            >
                              <ChildIcon className={cn("size-3.5 shrink-0", isChildActive ? "text-primary" : "text-muted-foreground group-hover:text-muted-foreground/50")} />
                              <span className="flex-1 truncate">{child.label}</span>
                              {isChildActive && <ChevronRight className="size-3 text-primary" />}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-navy-foreground/10", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <form action="/api/auth/logout" method="POST">
            <Tooltip>
              <TooltipTrigger render={<Button type="submit" variant="ghost" size="icon" aria-label="Çıkış Yap" className="w-full" />}>
                <LogOut className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="top">Çıkış Yap</TooltipContent>
            </Tooltip>
          </form>
        ) : (
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/50 hover:bg-navy-foreground/5 hover:text-navy-foreground transition-colors w-full touch-manipulation"
            >
              <LogOut className="size-4" />
              Çıkış Yap
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export { COMING_SOON_PREFIXES }
