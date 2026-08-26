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
  ScanLine,
  HardHat,
  Activity,
  MessageSquare,
  Calendar,
  Receipt,
  PackageSearch,
  UserCircle,
  Search,
  X,
  QrCode,
} from "lucide-react"
import { createContext, useContext, useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Sidebar,
  SidebarContent as SidebarContentSlot,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

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
  {
    label: "Abonelik",
    items: [
      { href: "/billing", label: "Paket & Faturalandırma", icon: Receipt },
      { href: "/billing/quota", label: "Kota Yönetimi", icon: BarChart3 },
    ],
  },
]

const COMING_SOON_PREFIXES: string[] = []

function isComingSoon(pathname: string): boolean {
  return COMING_SOON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

type PageHeaderState = {
  pageTitle?: string
  pageActions?: React.ReactNode
  showGlobalSearch?: boolean
}

const SetPageHeaderContext = createContext<(state: PageHeaderState) => void>(() => {})

const CONSTRAINED_WIDTH_CLASS = "max-w-3xl"
const WIDE_WIDTH_CLASS = "max-w-5xl"

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

export function AppShellChrome({
  children,
  initialSidebarCollapsed = false,
  enabledFeatures = [],
  userIdentity,
}: {
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
  enabledFeatures?: string[]
  userIdentity?: UserIdentity
}) {
  const [pageHeader, setPageHeader] = useState<PageHeaderState>({ showGlobalSearch: true })

  return (
    <SetPageHeaderContext.Provider value={setPageHeader}>
      <SidebarProvider defaultOpen={!initialSidebarCollapsed}>
        <AppSidebar enabledFeatures={enabledFeatures} userIdentity={userIdentity} />
        <SidebarInset className="min-h-screen bg-muted">
          <AppHeader pageHeader={pageHeader} userIdentity={userIdentity} />
          <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8">{children}</main>
        </SidebarInset>
        <MobileBottomNav userIdentity={userIdentity} />
      </SidebarProvider>
    </SetPageHeaderContext.Provider>
  )
}

function AppHeader({
  pageHeader,
  userIdentity,
}: {
  pageHeader: PageHeaderState
  userIdentity?: UserIdentity
}) {
  const { pageTitle, pageActions, showGlobalSearch = true } = pageHeader
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 bg-background border-b border-border">
      <div className="relative flex flex-nowrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        {/* Masaüstünde de görünür: SidebarRail ince bir kenar şeridi, tek başına
            keşfedilebilir bir kontrol değil — BAK-180 öncesi masaüstünde
            daraltma/genişletme kontrolü fiilen kayıptı. */}
        <SidebarTrigger className={cn("-ml-2", mobileSearchOpen && "hidden sm:inline-flex")} />

        {/* Logo yalnız dar mobilde (<sm): sm+ arama input açılınca absolute logo
            input'un üstüne biniyordu. lg'de sidebar zaten markayı taşıyor. */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 sm:hidden",
            mobileSearchOpen && "hidden",
          )}
        >
          <Link href={isTechRole ? "/technician" : "/dashboard"} aria-label="BakimX" className="flex items-center">
            <BrandLogo variant="icon-light" size="md" priority alt="BakimX" />
          </Link>
        </div>

        {pageTitle && (
          <div className="hidden min-w-0 md:flex md:max-w-48 md:flex-col lg:max-w-64">
            <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{pageTitle}</h1>
          </div>
        )}

        {showGlobalSearch && (
          <div
            className={cn(
              "min-w-0 sm:min-w-48 sm:flex-1 sm:shrink sm:basis-auto sm:max-w-xl",
              mobileSearchOpen ? "flex-1 basis-auto" : "shrink-0 basis-9 sm:basis-auto",
            )}
          >
            {mobileSearchOpen ? (
              <div className="flex items-center gap-1">
                <GlobalSearch className="w-full min-w-0" autoFocus />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 sm:hidden"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Aramayı kapat"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 sm:hidden"
                  onClick={() => setMobileSearchOpen(true)}
                  aria-label="Ara"
                >
                  <Search className="size-4" />
                </Button>
                <div className="hidden sm:block">
                  <GlobalSearch className="w-full min-w-0" />
                </div>
              </>
            )}
          </div>
        )}

        {!showGlobalSearch && <div className="flex-1" />}

        <div
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5",
            mobileSearchOpen && "hidden sm:flex",
          )}
        >
          <CreateCenterDialog />
          {isTechRole ? (
            <TechnicianNotificationsBell />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Bildirimler">
                  <Bell className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Bildirimler (yakında)</TooltipContent>
            </Tooltip>
          )}
          <UserMenu userIdentity={userIdentity} />
        </div>
      </div>
      {(pageTitle || pageActions) && !mobileSearchOpen && (
        <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3 -mt-1">
          {pageTitle && <h1 className="text-base font-semibold text-foreground truncate">{pageTitle}</h1>}
          {pageActions}
        </div>
      )}
    </header>
  )
}

function AppSidebar({
  enabledFeatures = [],
  userIdentity,
}: {
  enabledFeatures?: string[]
  userIdentity?: UserIdentity
}) {
  const pathname = usePathname()
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)

  const visibleGroups = (isTechRole ? TECHNICIAN_NAV_GROUPS : NAV_GROUPS).map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.feature || enabledFeatures.includes(item.feature)),
  })).filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <Link
          href={isTechRole ? "/technician" : "/dashboard"}
          aria-label="BakimX"
          className="flex size-8 items-center justify-center"
        >
          <BrandLogo variant="icon-dark" size="sm" priority alt="BakimX" />
        </Link>
      </SidebarHeader>

      <SidebarContentSlot>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContentSlot>

      <SidebarFooter className="border-t border-sidebar-border">
        {userIdentity && (
          <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium text-sidebar-foreground/80 truncate">
              {[userIdentity.firstName, userIdentity.lastName].filter(Boolean).join(" ") || userIdentity.email || userIdentity.username}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              {ROLE_LABELS[userIdentity.role]}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Hesabım">
              <Link href="/account">
                <UserCircle className="size-4" />
                <span>Hesabım</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action="/api/auth/logout" method="POST" className="w-full">
              <SidebarMenuButton type="submit" tooltip="Çıkış Yap">
                <LogOut className="size-4" />
                <span>Çıkış Yap</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0
  const isParentActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  const isAnyChildActive = hasChildren
    ? item.children!.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
    : false
  const isActive = hasChildren ? isAnyChildActive || isParentActive : isParentActive
  const isSoon = isComingSoon(item.href)

  const [expanded, setExpanded] = useState(isActive && hasChildren)

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.label}
          className={cn(isSoon && !isActive && "opacity-60")}
        >
          <Link href={item.href}>
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setExpanded(!expanded)}
        isActive={isActive}
        tooltip={item.label}
        className={cn(isSoon && !isActive && "opacity-60")}
      >
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={pathname === item.href}>
              <Link href={item.href}>
                <Icon className="size-3.5" />
                <span>{item.label} Özeti</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          {item.children!.map((child) => {
            const ChildIcon = child.icon
            const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
            return (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton asChild isActive={isChildActive}>
                  <Link href={child.href}>
                    <ChildIcon className="size-3.5" />
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

function MobileBottomNav({ userIdentity }: { userIdentity?: UserIdentity }) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const [createOpen, setCreateOpen] = useState(false)

  if (!isMobile) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border safe-area-bottom">
      {isTechnicianRestrictedRole(userIdentity?.role) ? (
        <>
          <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
            <MobileNavLink
              href="/technician"
              label="Teknisyen"
              icon={HardHat}
              active={pathname === "/technician" || pathname.startsWith("/technician/")}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                size="icon"
                className="-mt-7 size-14 rounded-full shadow-md ring-4 ring-background"
                aria-label="Oluşturma merkezi"
                onClick={() => setCreateOpen(true)}
              >
                <QrCode className="size-6" />
              </Button>
            </div>
            <MobileNavLink
              href="/account"
              label="Hesabım"
              icon={UserCircle}
              active={pathname === "/account" || pathname.startsWith("/account/")}
            />
          </div>
          <CreateCenterDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
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
        className="size-8"
        aria-label="Kullanıcı menüsü"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary-strong text-[11px] font-semibold">
          {initials}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-popover shadow-lg z-50 py-1">
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
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2.5 rounded-none px-3 py-2 font-normal"
              >
                <LogOut className="size-4 text-muted-foreground" />
                Çıkış Yap
              </Button>
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

export { COMING_SOON_PREFIXES }
