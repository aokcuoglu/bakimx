"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/shared/brand-logo"
import { GlobalSearch, type SearchDestination } from "@/components/layout/global-search-box"
import { CreateCenterDialog } from "@/components/layout/create-center-dialog"
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from "@/components/layout/workspace-switcher"
import { SettingsNav } from "@/components/settings/settings-nav"
import { DashboardProductTour } from "@/components/dashboard/dashboard-product-tour"
import { ACCOUNT_SETTINGS_ITEMS, SETTINGS_NAV_GROUPS, isSettingsPath } from "@/lib/settings-nav"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { TechnicianNotificationsBell } from "@/components/technician/technician-notifications-bell"
import type { GatedFeature } from "@/lib/plan"
import type { SidebarPlanStatus } from "@/lib/billing/sidebar-plan-status"
import type { UserRole } from "@prisma/client"
import {
  LayoutDashboard,
  Car,
  Users,
  Wrench as WrenchIcon,
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
  ArrowLeft,
  MessageSquare,
  Calendar,
  Receipt,
  PackageSearch,
  UserCircle,
  UserRoundPlus,
  Search,
  QrCode,
  LockKeyhole,
} from "lucide-react"
import { createContext, useContext, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  feature?: GatedFeature
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
      { href: "/technician", label: "Teknisyen Paneli", icon: HardHat, feature: "team" },
      { href: "/customers", label: "Müşteriler", icon: Users },
      { href: "/vehicles", label: "Araçlar", icon: Car },
      { href: "/quotes", label: "Teklifler", icon: FileText, feature: "quotes" },
      { href: "/appointments", label: "Randevular", icon: CalendarClock, feature: "appointments" },
      { href: "/calendar", label: "Takvim", icon: Calendar, feature: "appointments" },
      { href: "/reminders", label: "Bakım Hatırlatmaları", icon: BellRing, feature: "automatedReminders" },
      { href: "/smart-capture/registration", label: "Ruhsat Okuma", icon: ScanLine, feature: "ocrIntake" },
    ],
  },
  {
    label: "Depo & Finans",
    items: [
      { href: "/parts", label: "Stok / Parçalar", icon: Boxes, feature: "partsInventory" },
      { href: "/purchases", label: "Dış Alımlar", icon: ShoppingCart, feature: "procurement" },
      {
        href: "/bakimx-orders",
        label: "BakımX Siparişleri",
        icon: PackageSearch,
        feature: "procurement",
      },
      { href: "/suppliers", label: "Tedarikçiler", icon: Truck, feature: "procurement" },
      { href: "/cashbox", label: "Kasa", icon: Wallet, children: [
        { href: "/cashbox/payments", label: "Tahsilatlar", icon: Receipt },
        { href: "/cashbox/aging", label: "Yaşlandırma", icon: BarChart3 },
      ], feature: "cashbox" },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/analytics", label: "Operasyonel Analiz", icon: Activity, feature: "analytics" },
      { href: "/reports", label: "Raporlar", icon: BarChart3, feature: "reports" },
    ],
  },
  {
    label: "İletişim",
    items: [
      { href: "/communications", label: "İletişim Kayıtları", icon: MessageSquare, feature: "communications" },
    ],
  },
]

const COMING_SOON_PREFIXES: string[] = []

/** Stable product-tour anchors for primary sidebar destinations. */
const NAV_TOUR_ATTR: Partial<Record<string, string>> = {
  "/dashboard": "nav-dashboard",
  "/orders": "nav-orders",
  "/customers": "nav-customers",
}

const APP_NAV_TEXT = "h-9 text-[clamp(16px,calc(var(--sidebar-width)*0.054),18px)] leading-6 font-medium tracking-[-0.01em]"

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

export type WorkspaceSwitcherProps = {
  currentWorkshopId: string
  memberships: WorkspaceSwitcherItem[]
  canCreateBranch: boolean
}

export function AppShellChrome({
  children,
  initialSidebarCollapsed = false,
  enabledFeatures = [],
  userIdentity,
  showDashboardTour = false,
  planStatus,
  workspace,
  topBannerVisible = false,
}: {
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
  enabledFeatures?: GatedFeature[]
  userIdentity?: UserIdentity
  showDashboardTour?: boolean
  planStatus?: SidebarPlanStatus | null
  workspace?: WorkspaceSwitcherProps | null
  topBannerVisible?: boolean
}) {
  const [pageHeader, setPageHeader] = useState<PageHeaderState>({ showGlobalSearch: true })
  const [searchOpen, setSearchOpen] = useState(false)
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)
  const primaryNavigation = (isTechRole ? TECHNICIAN_NAV_GROUPS : NAV_GROUPS)
    .flatMap((group) => group.items.flatMap((item) => [
      item,
      ...(item.children ?? []).map((child) => ({ ...child, feature: child.feature ?? item.feature })),
    ]))
  const settingsNavigation = isTechRole
    ? ACCOUNT_SETTINGS_ITEMS
    : SETTINGS_NAV_GROUPS.flatMap((group) => group.items)
  const searchNavigation: SearchDestination[] = [...primaryNavigation, ...settingsNavigation]

  return (
    <SetPageHeaderContext.Provider value={setPageHeader}>
      <SidebarProvider defaultOpen={!initialSidebarCollapsed}>
        <AppSidebar
          enabledFeatures={enabledFeatures}
          userIdentity={userIdentity}
          planStatus={planStatus}
          workspace={workspace}
          showGlobalSearch={pageHeader.showGlobalSearch ?? true}
          topBannerVisible={topBannerVisible}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <SidebarInset className="min-h-screen bg-background">
          <AppHeader pageHeader={pageHeader} userIdentity={userIdentity} topBannerVisible={topBannerVisible} />
          <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8">{children}</main>
        </SidebarInset>
        <MobileBottomNav userIdentity={userIdentity} enabledFeatures={enabledFeatures} />
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          navigation={searchNavigation}
          enabledFeatures={enabledFeatures}
          role={userIdentity?.role}
        />
        {showDashboardTour ? <DashboardProductTour enabled /> : null}
      </SidebarProvider>
    </SetPageHeaderContext.Provider>
  )
}

function AppHeader({
  pageHeader,
  userIdentity,
  topBannerVisible,
}: {
  pageHeader: PageHeaderState
  userIdentity?: UserIdentity
  topBannerVisible: boolean
}) {
  const { pageTitle, pageActions } = pageHeader
  const pathname = usePathname()
  const navTitle = [...NAV_GROUPS, ...TECHNICIAN_NAV_GROUPS]
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label
  const headerTitle = pageTitle || navTitle || (isSettingsPath(pathname) ? "Ayarlar" : undefined)
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)

  return (
    <header className={cn("sticky top-0 z-30 bg-background border-b border-border", topBannerVisible && "lg:top-9")}>
      <div className="relative flex flex-nowrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        {/* Sidebar açıkken kontrol menü başlığındadır; kapalıyken burada görünür. */}
        <SidebarTrigger data-tour="sidebar-trigger" className="-ml-2 lg:group-data-[sidebar-state=expanded]/sidebar-wrapper:hidden" />

        <div className="absolute left-1/2 -translate-x-1/2 sm:hidden">
          <Link href={isTechRole ? "/technician" : "/dashboard"} aria-label="BakimX" className="flex items-center">
            <BrandLogo variant="icon-light" size="md" priority alt="BakimX" />
          </Link>
        </div>

        {headerTitle && (
          <div className="hidden min-w-0 md:flex md:max-w-48 md:flex-col lg:max-w-64">
            <h1 className="truncate text-lg font-semibold leading-6 tracking-[-0.02em] text-foreground">{headerTitle}</h1>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {isTechRole ? <div className="lg:hidden"><TechnicianNotificationsBell /></div> : null}
        </div>
      </div>
      {(headerTitle || pageActions) && (
        <div className="sm:hidden flex items-center justify-between gap-2 px-4 pb-3 -mt-1">
          {headerTitle && <h1 className="truncate text-base font-semibold leading-6 tracking-[-0.02em] text-foreground">{headerTitle}</h1>}
          {pageActions}
        </div>
      )}
    </header>
  )
}

function AppSidebar({
  enabledFeatures = [],
  userIdentity,
  planStatus,
  workspace,
  showGlobalSearch,
  topBannerVisible,
  onOpenSearch,
}: {
  enabledFeatures?: GatedFeature[]
  userIdentity?: UserIdentity
  planStatus?: SidebarPlanStatus | null
  workspace?: WorkspaceSwitcherProps | null
  showGlobalSearch: boolean
  topBannerVisible: boolean
  onOpenSearch: () => void
}) {
  const pathname = usePathname()
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)
  const inSettings = isSettingsPath(pathname)
  const { isMobile, setOpenMobile } = useSidebar()

  const visibleGroups = (isTechRole ? TECHNICIAN_NAV_GROUPS : NAV_GROUPS).map((group) => ({
    ...group,
    items: group.items,
  })).filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="offcanvas" className={topBannerVisible ? "lg:top-9! lg:h-[calc(100svh-2.25rem)]!" : undefined}>
      <SidebarHeader className="flex-row items-center gap-1 border-b border-sidebar-border p-2">
        <div className="min-w-0 flex-1">
          {inSettings ? (
            <Button variant="ghost" size="sm" asChild className="justify-start gap-2 px-2 text-lg font-semibold leading-6 tracking-[-0.02em]">
              <Link
                href={isTechRole ? "/technician" : "/dashboard"}
                aria-label="Ana menüye dön"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Ayarlar</span>
              </Link>
            </Button>
          ) : workspace && !isTechRole ? (
            <WorkspaceSwitcher
              currentWorkshopId={workspace.currentWorkshopId}
              memberships={workspace.memberships}
              canCreateBranch={workspace.canCreateBranch}
            />
          ) : (
            <Link
              href={isTechRole ? "/technician" : "/dashboard"}
              aria-label="BakimX"
              className="flex size-8 items-center justify-center"
            >
              <BrandLogo variant="icon-light" size="sm" priority alt="BakimX" className="dark:hidden" />
              <BrandLogo variant="icon-dark" size="sm" alt="BakimX" className="hidden dark:block" />
            </Link>
          )}
        </div>
        <SidebarTrigger className="hidden shrink-0 lg:inline-flex" />
      </SidebarHeader>

      {!inSettings || isTechRole ? (
        <div className="flex items-center gap-1 px-3 py-2 group-data-[collapsible=icon]:hidden">
          {!inSettings && showGlobalSearch ? (
            <div data-tour="global-search" className="min-w-0 flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                  onOpenSearch()
                }}
                className="h-9 w-full justify-start gap-2 truncate px-2 text-[clamp(16px,calc(var(--sidebar-width)*0.054),18px)] font-medium leading-6 tracking-[-0.01em]"
                aria-label="Genel arama"
              >
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left">Ara</span>
                <span className="hidden shrink-0 rounded-sm border border-border px-1 text-[11px] leading-4 text-muted-foreground xl:inline">⌘ K</span>
              </Button>
            </div>
          ) : null}
          {isTechRole ? (
            !isMobile ? <TechnicianNotificationsBell /> : null
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Bildirimler">
                  <Bell className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Bildirimler (yakında)</TooltipContent>
            </Tooltip>
          )}
        </div>
      ) : null}

      <SidebarContentSlot>
        {inSettings ? (
          <SettingsNav enabledFeatures={enabledFeatures} role={userIdentity?.role} />
        ) : (
          visibleGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[clamp(13px,calc(var(--sidebar-width)*0.042),14px)] leading-5 tracking-[-0.01em]">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavMenuItem key={item.href} item={item} pathname={pathname} enabledFeatures={enabledFeatures} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContentSlot>

      <SidebarFooter className="border-t border-sidebar-border">
        {!inSettings && (isTechRole || !workspace) ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Hesap ayarları"
                isActive={pathname === "/settings/account" || pathname.startsWith("/account")}
                className={APP_NAV_TEXT}
              >
                <Link href="/settings/account">
                  <UserCircle className="size-4" />
                  <span>Hesap ayarları</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <form action="/api/auth/logout" method="POST" className="w-full">
                <SidebarMenuButton type="submit" tooltip="Çıkış Yap" className={APP_NAV_TEXT}>
                  <LogOut className="size-4" />
                  <span>Çıkış Yap</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        {!inSettings && !isTechRole && workspace && (userIdentity?.role === "owner" || userIdentity?.role === "manager") ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Üyeleri davet et" className={APP_NAV_TEXT}>
                <Link href="/settings/team?invite=1">
                  <UserRoundPlus className="size-4" />
                  <span>Üyeleri davet et</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        {planStatus && !inSettings ? (
          <SidebarMenu className="border-t border-sidebar-border pt-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={`${planStatus.title} · ${planStatus.detail}`} className="h-auto min-h-12 group-data-[collapsible=icon]:size-8!">
                <Link href="/settings/plans">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-base font-medium leading-5 tracking-[-0.01em]">{planStatus.title}</span>
                  <span className="block truncate text-sm leading-5 text-muted-foreground">{planStatus.detail}</span>
                  </span>
                  <span className="rounded-md border border-sidebar-border px-1.5 py-1 text-[10px] group-data-[collapsible=icon]:hidden">{planStatus.action}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuItem({
  item,
  pathname,
  enabledFeatures,
}: {
  item: NavItem
  pathname: string
  enabledFeatures: GatedFeature[]
}) {
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
  const isLocked = Boolean(item.feature && !enabledFeatures.includes(item.feature))

  const [expanded, setExpanded] = useState(isActive && hasChildren)

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={isLocked ? `${item.label} · Profesyonel` : item.label}
          className={cn(APP_NAV_TEXT, isSoon && !isActive && "opacity-60")}
        >
          <Link href={item.href} {...(NAV_TOUR_ATTR[item.href] ? { "data-tour": NAV_TOUR_ATTR[item.href] } : {})}>
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {isLocked && (
              <>
                <LockKeyhole className="size-3.5 shrink-0" />
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] group-data-[collapsible=icon]:hidden">
                  PRO
                </Badge>
              </>
            )}
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
        tooltip={isLocked ? `${item.label} · Profesyonel` : item.label}
        className={cn(APP_NAV_TEXT, isSoon && !isActive && "opacity-60")}
      >
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        {isLocked && <LockKeyhole className="size-3.5 shrink-0" />}
        {isLocked && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] group-data-[collapsible=icon]:hidden">
            PRO
          </Badge>
        )}
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={pathname === item.href} className="text-[15px] leading-5 tracking-[-0.01em]">
              <Link href={item.href}>
                <Icon className="size-3.5" />
                <span>{item.label} Özeti</span>
                {isLocked && <LockKeyhole className="size-3" />}
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
                    {isLocked && <LockKeyhole className="size-3" />}
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

function MobileBottomNav({
  userIdentity,
  enabledFeatures,
}: {
  userIdentity?: UserIdentity
  enabledFeatures: GatedFeature[]
}) {
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
              <Button variant="foreground"
                type="button"
                size="icon"
                className="-mt-7 size-14 rounded-full shadow-md ring-4 ring-background"
                aria-label="Oluşturma merkezi"
                data-tour="create-center"
                onClick={() => setCreateOpen(true)}
              >
                <QrCode className="size-6" />
              </Button>
            </div>
            <MobileNavLink
              href="/settings/account"
              label="Profil"
              icon={UserCircle}
              active={pathname === "/settings/account" || pathname.startsWith("/account")}
            />
          </div>
          <CreateCenterDialog open={createOpen} onOpenChange={setCreateOpen} enabledFeatures={enabledFeatures} />
        </>
      ) : (
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          <MobileNavLink href="/dashboard" label="Panel" icon={LayoutDashboard} active={pathname === "/dashboard"} />
          <MobileNavLink
            href="/orders"
            label="İş Emirleri"
            icon={WrenchIcon}
            active={pathname === "/orders" || pathname.startsWith("/orders/")}
            tourId="mobile-nav-orders"
          />
          <MobileNavLink
            href="/technician"
            label="Teknisyen"
            icon={HardHat}
            active={pathname === "/technician" || pathname.startsWith("/technician/")}
            locked={!enabledFeatures.includes("team")}
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
  locked = false,
  tourId,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  locked?: boolean
  tourId?: string
}) {
  return (
    <Link
      href={href}
      {...(tourId ? { "data-tour": tourId } : {})}
      className={cn(
        "flex flex-col items-center gap-0.5 text-[10px] py-1.5 rounded-lg transition-colors touch-manipulation",
        active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative">
        <Icon className="size-5" />
        {locked && <LockKeyhole className="absolute -right-2 -top-1 size-3 rounded-full bg-background" />}
      </span>
      <span className="truncate">{label}{locked ? " · Pro" : ""}</span>
    </Link>
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
      { href: "/settings/account", label: "Profil", icon: UserCircle },
    ],
  },
]

export { COMING_SOON_PREFIXES }
