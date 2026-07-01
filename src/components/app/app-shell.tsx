"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/shared/brand-logo"
import {
  LayoutDashboard,
  Car,
  Users,
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
import { createContext, useContext, useEffect, useState } from "react"
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
    items: [{ href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard }],
  },
  {
    label: "Servis",
    items: [
      { href: "/orders", label: "İş Emirleri", icon: WrenchIcon },
      { href: "/technician", label: "Teknisyen Paneli", icon: HardHat },
      { href: "/customers", label: "Müşteriler", icon: Users },
      { href: "/vehicles", label: "Araçlar", icon: Car },
      { href: "/quotes", label: "Teklifler", icon: FileText },
      { href: "/appointments", label: "Randevular", icon: CalendarClock },
      { href: "/calendar", label: "Takvim", icon: Calendar },
      { href: "/reminders", label: "Bakım Hatırlatmaları", icon: BellRing },
      { href: "/smart-capture/registration", label: "Ruhsat Okuma", icon: ScanLine },
    ],
  },
  {
    label: "Depo & Finans",
    items: [
      { href: "/parts", label: "Stok / Parçalar", icon: Boxes },
      { href: "/suppliers", label: "Tedarikçiler", icon: Truck },
      { href: "/cashbox", label: "Kasa", icon: Wallet, children: [
        { href: "/cashbox/payments", label: "Tahsilatlar", icon: Receipt },
        { href: "/cashbox/aging", label: "Yaşlandırma", icon: BarChart3 },
      ] },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/analytics", label: "Operasyonel Analiz", icon: Activity },
      { href: "/reports", label: "Raporlar", icon: BarChart3 },
    ],
  },
  {
    label: "İletişim",
    items: [
      { href: "/communications", label: "İletişim Kayıtları", icon: MessageSquare },
    ],
  },
  {
    label: "Ayarlar",
    items: [
      { href: "/settings?tab=profile", label: "Ayarlar", icon: Settings },
      { href: "/settings?tab=team", label: "Ekip", icon: Users },
      { href: "/settings/notifications", label: "Bildirim Ayarları", icon: Bell },
      { href: "/settings/calendar", label: "Takvim Ayarları", icon: Calendar },
    ],
  },
]

const COMING_SOON_PREFIXES: string[] = []

function isComingSoon(pathname: string): boolean {
  return COMING_SOON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Sidebar daraltma tercihi cookie'de tutulur (localStorage değil): layout.tsx bunu
// sunucuda okuyup ilk render'a `initialSidebarCollapsed` olarak geçirir. Böylece
// sunucu ve istemcinin ilk render'ı hep aynı genişlikle başlar — hydration sonrası
// düzeltme yapılmadığı için sidebar'ın bir an açılıp kapanması (flash) da olmaz.
const SIDEBAR_COOKIE_KEY = "sidebar-state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function writeSidebarCollapsedCookie(collapsed: boolean): void {
  document.cookie = `${SIDEBAR_COOKIE_KEY}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`
}

// Per-page başlık/aksiyon/arama bilgisi context üzerinden taşınır. Kalıcı kabuk
// (AppShellChrome) artık layout'ta bir kez mount edildiği ve gezinti boyunca
// mount kaldığı için; sayfa içindeki <AppShell> yalnızca bu bilgiyi günceller.
// Böylece sidebar ve header gezinti sırasında yeniden mount olmaz (titreme/kayma
// sorununun kök nedeni buydu).
type PageHeaderState = {
  pageTitle?: string
  pageActions?: React.ReactNode
  showGlobalSearch?: boolean
}

const SetPageHeaderContext = createContext<(state: PageHeaderState) => void>(() => {})

/**
 * Sayfaların render ettiği ince sarmalayıcı. Görsel kabuk çizmez; verilen
 * başlık/aksiyon/arama bilgisini kalıcı kabuğa iletir ve içeriğini olduğu gibi
 * döndürür. Çağrı API'si geriye dönük uyumludur (`workshopName` prop'u artık
 * kullanılmıyor; mevcut sayfa çağrılarını bozmamak için kabul edilip yok sayılır).
 */
export function AppShell({
  children,
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
  const setPageHeader = useContext(SetPageHeaderContext)
  useEffect(() => {
    setPageHeader({ pageTitle, pageActions, showGlobalSearch })
  }, [setPageHeader, pageTitle, pageActions, showGlobalSearch])
  return <>{children}</>
}

/**
 * Kalıcı uygulama kabuğu: sidebar, üst header ve mobil alt navigasyon. layout
 * tarafından bir kez mount edilir ve sayfa gezintisi boyunca mount kalır; yalnız
 * içerik alanı (children) Suspense/loading ile değişir.
 */
export function AppShellChrome({
  children,
  initialSidebarCollapsed = false,
}: {
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pageHeader, setPageHeader] = useState<PageHeaderState>({ showGlobalSearch: true })
  const { pageTitle, pageActions, showGlobalSearch = true } = pageHeader
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [searchValue, setSearchValue] = useState("")

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    writeSidebarCollapsedCookie(next)
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = searchValue.trim()
    if (!value) return
    router.push(`/parts?q=${encodeURIComponent(value)}`)
  }

  const desktopSidebarWidth = sidebarCollapsed ? "lg:w-16" : "lg:w-64"
  const desktopContentPadding = sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"

  return (
    <SetPageHeaderContext.Provider value={setPageHeader}>
    <div className="min-h-screen bg-muted">
      <div className="flex">
        <aside
          className={cn(
            "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-navy text-navy-foreground border-r border-navy-foreground/10 transition-[width] duration-200 ease-in-out",
            desktopSidebarWidth,
          )}
        >
          <SidebarContent
            pathname={pathname}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 bg-navy text-navy-foreground border-r border-navy-foreground/10 p-0 flex flex-col" showCloseButton={false}>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 z-10 text-navy-foreground/60 hover:text-navy-foreground p-1.5 rounded-md hover:bg-navy-foreground/10 touch-manipulation"
              aria-label="Menüyü kapat"
            >
              <X className="size-5" />
            </button>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent pathname={pathname} onClose={() => setSidebarOpen(false)} />
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
                      className="pl-9"
                    />
                  </div>
                </form>
              )}

              {!showGlobalSearch && <div className="flex-1" />}

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/orders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <Plus className="size-4" />
                  <span>Yeni İş Emri</span>
                </Link>
                <Link
                  href="/quotes/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <FileText className="size-4" />
                  <span>Yeni Teklif</span>
                </Link>
                <Link
                  href="/appointments/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <CalendarClock className="size-4" />
                  <span>Yeni Randevu</span>
                </Link>
                <Link
                  href="/reminders/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors touch-manipulation"
                >
                  <BellRing className="size-4" />
                  <span>Yeni Hatırlatma</span>
                </Link>
                <Link
                  href="/orders/new"
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
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          <MobileNavLink href="/dashboard" label="Panel" icon={LayoutDashboard} active={pathname === "/dashboard"} />
          <MobileNavLink
            href="/orders"
            label="İş Emirleri"
            icon={WrenchIcon}
            active={pathname === "/orders" || pathname.startsWith("/orders/")}
          />
          <MobileNavLink
            href="/technician"
            label="Teknisyen"
            icon={HardHat}
            active={pathname === "/technician" || pathname.startsWith("/technician/")}
          />
          <MobileNavLink
            href="/customers"
            label="Müşteriler"
            icon={Users}
            active={pathname.startsWith("/customers") || pathname.startsWith("/vehicles")}
          />
        </div>
      </nav>
    </div>
    </SetPageHeaderContext.Provider>
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
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  pathname: string
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
            <TooltipTrigger render={<Link href="/dashboard" onClick={onClose} aria-label="BakimX" className="flex items-center group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-deep">
              {collapsed ? (
                <BrandLogo variant="icon-dark" size="sm" priority alt="BakimX" />
              ) : (
                <BrandLogo variant="icon-dark" size="lg" priority alt="BakimX" />
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
      </div>

      <nav className={cn("flex-1 py-4 space-y-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-foreground/55">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const hasChildren = item.children && item.children.length > 0
                const isParentActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
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
                            : "text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}>
                          <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-navy-foreground/55 group-hover/collapsed:text-navy-foreground")} />
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
                            : "text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-navy-foreground/55 group-hover:text-navy-foreground")} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isExpanded
                          ? <ChevronDown className="size-3.5 text-navy-foreground/55" />
                          : <ChevronRight className="size-3.5 text-navy-foreground/55" />}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary/15 text-navy-foreground border-l-2 border-brand"
                            : "text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground",
                          isSoon && !isActive && "opacity-60"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-navy-foreground/55 group-hover:text-navy-foreground")} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-navy-foreground/5 text-navy-foreground/60">
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
                              : "text-navy-foreground/55 hover:bg-navy-foreground/5 hover:text-navy-foreground"
                          )}
                        >
                          <Icon className={cn("size-3.5 shrink-0", pathname === item.href ? "text-primary" : "text-navy-foreground/55 group-hover:text-navy-foreground")} />
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
                                  : "text-navy-foreground/55 hover:bg-navy-foreground/5 hover:text-navy-foreground"
                              )}
                            >
                              <ChildIcon className={cn("size-3.5 shrink-0", isChildActive ? "text-primary" : "text-navy-foreground/55 group-hover:text-navy-foreground")} />
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
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground transition-colors w-full touch-manipulation"
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
