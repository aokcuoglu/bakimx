"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/shared/brand-logo"
import { GlobalSearch } from "@/components/layout/global-search-box"
import { CreateCenterDialog } from "@/components/layout/create-center-dialog"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { TechnicianNotificationsBell } from "@/components/technician/technician-notifications-bell"
import { ROLE_LABELS } from "@/lib/roles"
import type { UserRole } from "@prisma/client"
import {
  LayoutDashboard,
  Car,
  Users,
  Wrench as WrenchIcon,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  FileText,
  CalendarClock,
  BellRing,
  Boxes,
  Truck,
  ShoppingCart,
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
  PackageSearch,
  UserCircle,
} from "lucide-react"
import { createContext, useContext, useEffect, useState, useRef } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export type UserIdentity = {
  firstName: string | null
  lastName: string | null
  email: string | null
  username: string | null
  role: UserRole
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
  /**
   * Bu bağlantı bir özellik kapısının arkasındaysa kapının anahtarı. Kapı kapalı
   * atölyede bağlantı hiç render EDİLMEZ — sayfanın kendisi 404 verdiği için
   * (bkz. (app)/bakimx-orders/page.tsx) menüde bırakmak kırık bağlantı olurdu.
   * Kapının kendisi sunucuda çözülür ve `enabledFeatures` ile buraya iner;
   * istemci hiçbir zaman kapıyı kendisi hesaplamaz.
   */
  feature?: string
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
      { href: "/purchases", label: "Dış Alımlar", icon: ShoppingCart },
      {
        href: "/bakimx-orders",
        label: "BakımX Siparişleri",
        icon: PackageSearch,
        feature: "bakimxCatalog",
      },
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
 * Tek-kolon detay ve form sayfalarının içeriğini rahat okunur bir genişliğe
 * sınırlayan sol-hizalı sarmalayıcı sınıfı. `/parts/new` referans alındı; tüm
 * `constrained` sayfalar bu tek sabitten beslenir (değiştirmek için tek yer).
 * Mobilde etkisizdir (ekran zaten bu genişliğin altında). İki/çok-kolon wizard
 * sayfaları (quote/vehicle create, order wizard) bunu kullanmaz.
 */
const CONSTRAINED_WIDTH_CLASS = "max-w-3xl"
/** `wide` sayfalar (ör. iş emri detayı — parça tablosu ek kolonlarla) daha geniş. */
const WIDE_WIDTH_CLASS = "max-w-5xl"

/**
 * Sayfaların render ettiği ince sarmalayıcı. Görsel kabuk çizmez; verilen
 * başlık/aksiyon/arama bilgisini kalıcı kabuğa iletir. `constrained` verilirse
 * içeriği sol-hizalı sınırlı bir genişlikte sarar; aksi halde olduğu gibi döner.
 * Çağrı API'si geriye dönük uyumludur (`workshopName` prop'u artık kullanılmıyor;
 * mevcut sayfa çağrılarını bozmamak için kabul edilip yok sayılır).
 */
export function AppShell({
  children,
  pageTitle,
  pageActions,
  showGlobalSearch = true,
  constrained = false,
  wide = false,
}: {
  children: React.ReactNode
  workshopName?: string
  pageTitle?: string
  pageActions?: React.ReactNode
  showGlobalSearch?: boolean
  constrained?: boolean
  /** constrained'den daha geniş bir sarmalayıcı (ör. iş emri detayı). */
  wide?: boolean
}) {
  const setPageHeader = useContext(SetPageHeaderContext)
  useEffect(() => {
    setPageHeader({ pageTitle, pageActions, showGlobalSearch })
  }, [setPageHeader, pageTitle, pageActions, showGlobalSearch])
  if (wide) return <div className={WIDE_WIDTH_CLASS}>{children}</div>
  if (constrained) return <div className={CONSTRAINED_WIDTH_CLASS}>{children}</div>
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
  enabledFeatures = [],
  userIdentity,
}: {
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
  /**
   * Bu atölyede AÇIK olan özellik kapıları — sunucuda `resolveFeature` ile
   * çözülür (bkz. (app)/layout.tsx). `feature` taşıyan menü satırı yalnız
   * anahtarı bu listede varsa çıkar.
   */
  enabledFeatures?: string[]
  userIdentity?: UserIdentity
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pageHeader, setPageHeader] = useState<PageHeaderState>({ showGlobalSearch: true })
  const { pageTitle, pageActions, showGlobalSearch = true } = pageHeader
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  // ab2acb2 (BAK-136) mobil logo linkinde bunu kullanıyordu ama tanımı yalnız
  // SidebarContent içindeydi; typecheck kırıktı.
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    writeSidebarCollapsedCookie(next)
  }

  const desktopSidebarWidth = sidebarCollapsed ? "lg:w-16" : "lg:w-64"
  const desktopContentPadding = sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"

  return (
    <SetPageHeaderContext.Provider value={setPageHeader}>
    <div className="min-h-screen bg-muted">
      <div className="flex">
        <aside
          className={cn(
            "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 bg-navy text-navy-foreground border-r border-navy-foreground/10 transition-[width] duration-200 ease-in-out",
            desktopSidebarWidth,
          )}
        >
          <SidebarContent
            pathname={pathname}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            enabledFeatures={enabledFeatures}
            userIdentity={userIdentity}
          />
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 bg-navy text-navy-foreground border-r border-navy-foreground/10 p-0 flex flex-col" showCloseButton={false}>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-1 right-1 z-10 text-navy-foreground/60 hover:bg-navy-foreground/10 hover:text-navy-foreground md:top-2 md:right-2"
              aria-label="Menüyü kapat"
            >
              <X className="size-5" />
            </Button>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent
                pathname={pathname}
                onClose={() => setSidebarOpen(false)}
                enabledFeatures={enabledFeatures}
                userIdentity={userIdentity}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className={cn("flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-[padding] duration-200 ease-in-out", desktopContentPadding)}>
          <header className="sticky top-0 z-30 bg-white border-b border-border">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap sm:gap-3 sm:px-6 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => setSidebarOpen(true)}
                className="-ml-2 lg:hidden"
                aria-label="Menüyü aç"
              >
                <Menu className="size-5" />
              </Button>

              <div className="lg:hidden absolute left-1/2 -translate-x-1/2">
                <Link href={isTechRole ? "/technician" : "/dashboard"} aria-label="BakimX" className="flex items-center">
                  <BrandLogo variant="icon-dark" size="sm" priority alt="BakimX" />
                </Link>
              </div>

              {pageTitle && (
                <div className="hidden min-w-0 md:flex md:max-w-48 md:flex-col lg:max-w-64">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{pageTitle}</h1>
                </div>
              )}

              {showGlobalSearch && (
                <div className="order-last w-full min-w-0 shrink-0 basis-full sm:order-none sm:min-w-48 sm:flex-1 sm:shrink sm:basis-auto sm:max-w-xl">
                  <GlobalSearch className="w-full min-w-0" />
                </div>
              )}

              {!showGlobalSearch && <div className="flex-1" />}

              <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
                {!isTechnicianRestrictedRole(userIdentity?.role) && <CreateCenterDialog />}
                {isTechnicianRestrictedRole(userIdentity?.role) ? (
                  <TechnicianNotificationsBell />
                ) : (
                  <Tooltip>
                    <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="Bildirimler" />}>
                      <Bell className="size-5" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Bildirimler (yakında)</TooltipContent>
                  </Tooltip>
                )}
                <UserMenu userIdentity={userIdentity} />
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
        {isTechnicianRestrictedRole(userIdentity?.role) ? (
          <div className="grid grid-cols-2 gap-1 px-2 py-1.5">
            <MobileNavLink
              href="/technician"
              label="Teknisyen"
              icon={HardHat}
              active={pathname === "/technician" || pathname.startsWith("/technician/")}
            />
            <MobileNavLink
              href="/account"
              label="Hesabım"
              icon={UserCircle}
              active={pathname === "/account" || pathname.startsWith("/account/")}
            />
          </div>
        ) : (
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
        )}
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

function UserMenu({ userIdentity }: { userIdentity?: UserIdentity }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const displayName = userIdentity
    ? [userIdentity.firstName, userIdentity.lastName].filter(Boolean).join(" ") || userIdentity.email || userIdentity.username || "Kullanıcı"
    : "Kullanıcı"
  const initials = userIdentity
    ? [userIdentity.firstName?.[0], userIdentity.lastName?.[0]].filter(Boolean).join("").toUpperCase() || displayName[0]?.toUpperCase() || "?"
    : "?"
  const roleLabel = userIdentity ? ROLE_LABELS[userIdentity.role] : ""
  const identifierText = userIdentity?.email || userIdentity?.username || ""

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Kullanıcı menüsü"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
          {initials}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-white shadow-lg z-50 py-1">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            {identifierText && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{identifierText}</p>
            )}
            {roleLabel && (
              <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {roleLabel}
              </span>
            )}
          </div>
          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <UserCircle className="size-4 text-muted-foreground" />
              Hesabım
            </Link>
          </div>
          <div className="border-t border-border py-1">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors w-full text-left"
              >
                <LogOut className="size-4 text-muted-foreground" />
                Çıkış Yap
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const TECHNICIAN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Teknisyen",
    items: [
      { href: "/technician", label: "Teknisyen Paneli", icon: HardHat },
    ],
  },
  {
    label: "Hesap",
    items: [
      { href: "/account", label: "Hesabım", icon: UserCircle },
    ],
  },
]

function SidebarContent({
  pathname,
  onClose,
  collapsed = false,
  onToggleCollapse,
  enabledFeatures = [],
  userIdentity,
}: {
  pathname: string
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  enabledFeatures?: string[]
  userIdentity?: UserIdentity
}) {
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)

  const visibleGroups = (isTechRole ? TECHNICIAN_NAV_GROUPS : NAV_GROUPS).map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.feature || enabledFeatures.includes(item.feature)),
  })).filter((group) => group.items.length > 0)

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
      {/* Daralt/genişlet toggle'ı, sidebar ile içerik arasındaki dikey çizginin
          üzerine oturan yüzen buton olarak konumlanır (aside `fixed` olduğu için
          absolute burada aside'a göre hizalanır). `top-5` merkezi (~32px), collapsed
          logo (sm=20px) ile expanded logo (lg=32px) dikey merkezinin arasına denk
          gelir; böylece iki durumda da logo hizasında kalır. Yalnız masaüstünde
          (onToggleCollapse geçilen aside'da) render edilir; mobil Sheet'te değil. */}
      {onToggleCollapse && (
        <Tooltip>
          <TooltipTrigger render={<Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className="absolute top-5 -right-3 z-40 flex items-center justify-center size-6 rounded-full bg-navy border border-navy-foreground/20 text-navy-foreground/70 shadow-sm transition-colors hover:bg-navy hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/40"
          />}>
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Menüyü genişlet" : "Menüyü daralt"}</TooltipContent>
        </Tooltip>
      )}
      <div className={cn("py-5 border-b border-navy-foreground/10", collapsed ? "px-2" : "px-5")}>
        <div className={collapsed ? "flex justify-center" : "flex items-center"}>
          <Tooltip>
            <TooltipTrigger render={<Link href={isTechRole ? "/technician" : "/dashboard"} onClick={onClose} aria-label="BakimX" className="flex items-center group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-deep">
              {collapsed ? (
                <BrandLogo variant="icon-dark" size="sm" priority alt="BakimX" />
              ) : (
                <BrandLogo variant="icon-dark" size="lg" priority alt="BakimX" />
              )}
              <span className="sr-only">BakimX</span>
            </Link>} />
            <TooltipContent side="right">BakimX</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <nav className={cn("flex-1 py-4 space-y-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", collapsed ? "px-2" : "px-3")}>
        {visibleGroups.map((group) => (
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleExpanded(item.href)}
                        className={cn(
                          "group h-auto w-full justify-start gap-2.5 px-3 py-2 text-left",
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
                      </Button>
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
          <div className="space-y-1">
            <Tooltip>
              <TooltipTrigger render={<Link href="/account" onClick={onClose} aria-label="Hesabım" className="flex items-center justify-center size-9 rounded-lg text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground transition-colors mx-auto" />}>
                <UserCircle className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">Hesabım</TooltipContent>
            </Tooltip>
            <form action="/api/auth/logout" method="POST">
              <Tooltip>
                <TooltipTrigger render={<Button type="submit" variant="ghost" size="icon" aria-label="Çıkış Yap" className="w-full" />}>
                  <LogOut className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="right">Çıkış Yap</TooltipContent>
              </Tooltip>
            </form>
          </div>
        ) : (
          <div className="space-y-1">
            {userIdentity && (
              <div className="px-3 py-1.5 mb-1">
                <p className="text-xs font-medium text-navy-foreground/80 truncate">
                  {[userIdentity.firstName, userIdentity.lastName].filter(Boolean).join(" ") || userIdentity.email || userIdentity.username}
                </p>
                <p className="text-[10px] text-navy-foreground/50 truncate">
                  {ROLE_LABELS[userIdentity.role]}
                </p>
              </div>
            )}
            <Link
              href="/account"
              onClick={onClose}
              className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground transition-all"
            >
              <UserCircle className="size-4" />
              Hesabım
            </Link>
            <form action="/api/auth/logout" method="POST">
              <Button
                type="submit"
                variant="ghost"
                className="h-auto w-full justify-start gap-2.5 px-3 py-2 text-navy-foreground/60 hover:bg-navy-foreground/5 hover:text-navy-foreground"
              >
                <LogOut className="size-4" />
                Çıkış Yap
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export { COMING_SOON_PREFIXES }
