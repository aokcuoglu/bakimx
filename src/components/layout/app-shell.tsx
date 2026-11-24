"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { isSidebarlessRoute } from "@/lib/sidebarless-route"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/shared/brand-logo"
import { GlobalSearch, type SearchDestination } from "@/components/layout/global-search-box"
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from "@/components/layout/workspace-switcher"
import { SettingsNav } from "@/components/settings/settings-nav"
import settingsSidebarStyles from "@/components/settings/settings-sidebar.module.css"
import shellStyles from "@/components/layout/app-shell.module.css"
import { DashboardProductTour } from "@/components/dashboard/dashboard-product-tour"
import { ACCOUNT_SETTINGS_ITEMS, SETTINGS_NAV_GROUPS, isSettingsPath, matchesSettingsNavItem } from "@/lib/settings-nav"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { actorCan, type Permission } from "@/lib/roles"
import { TechnicianNotificationsBell } from "@/components/technician/technician-notifications-bell"
import type { GatedFeature } from "@/lib/plan"
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/lib/navigation/app-nav"
import type { SidebarPlanStatus } from "@/lib/billing/sidebar-plan-status"
import type { UserRole } from "@prisma/client"
import {
  LogOut,
  Bell,
  CalendarClock,
  ChevronRight,
  ChevronDown,
  HardHat,
  ArrowLeft,
  UserCircle,
  UserRoundPlus,
  Search,
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
  teamPermissions?: Permission[] | null
}

const COMING_SOON_PREFIXES: string[] = []

/** Stable product-tour anchors for primary sidebar destinations. */
const NAV_TOUR_ATTR: Partial<Record<string, string>> = {
  "/dashboard": "nav-dashboard",
  "/orders": "nav-orders",
  "/customers": "nav-customers",
}

const APP_NAV_TEXT = "h-7 text-sm leading-5 font-medium tracking-[-0.005em]"

// These pages already introduce themselves in their content. The mobile bar
// keeps the brand mark there; list and utility pages use the bar for context.
const MOBILE_CONTENT_HEADING_PATHS = new Set([
  "/dashboard",
  "/orders",
  "/orders/new",
  "/customers/new",
  "/vehicles/new",
  "/technician",
  "/appointments/new",
  "/parts",
  "/suppliers",
  "/analytics",
  "/reports",
])

// Masaüstünde (lg+) üst bar yoktur: sayfa başlığı içerikte durur. Bar yalnız
// sidebar kapalıyken açma düğmesi için, mobil/tablette (<lg) menü düğmesi ve
// logo için, sidebar'sız teknisyen ekranlarında da hesap/çıkış için kalır.

// Sayfanın h1'ini her genişlikte içerik taşır (hero); barda başlık yazmaz.
// /orders: Genel Bakış kalıbında başlık + "Yeni Araç Kabul" satırını kendisi çizer.
const CONTENT_H1_PATHS = new Set(["/dashboard", "/orders"])

// Masaüstünde görünür başlığı kendi içeriğinde zaten olan menü sayfaları
// (hero, ikonlu liste başlığı, rapor menüsü). Bunlara ayrıca başlık basılmaz.
const OWN_TITLE_MENU_PATHS = new Set(["/dashboard", "/technician", "/parts", "/suppliers", "/reports"])

// Menü sayfası olmadığı hâlde görünür başlığı yalnız bardaydı.
const BAR_TITLE_ONLY_PATHS = new Set(["/quotes/new", "/cashbox/payments/new", "/customers/balances"])

const MENU_PATHS = new Set(
  NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)])),
)

/**
 * Masaüstünde sayfa başlığı içerikte nasıl durur: liste/menü sayfalarında
 * görünür büyük başlık; detay ve form sayfaları başlığı kartında/formunda
 * zaten taşıdığı için yalnız ekran okuyucuya h1; hero'lu sayfada hiç.
 */
function desktopTitleMode(pathname: string): "visible" | "sr-only" | "none" {
  if (CONTENT_H1_PATHS.has(pathname)) return "none"
  if (OWN_TITLE_MENU_PATHS.has(pathname)) return "sr-only"
  if (MENU_PATHS.has(pathname) || BAR_TITLE_ONLY_PATHS.has(pathname)) return "visible"
  return "sr-only"
}

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
  const pathname = usePathname()
  useEffect(() => {
    setPageHeader({ pageTitle, pageActions, showGlobalSearch })
  }, [setPageHeader, pageTitle, pageActions, showGlobalSearch])
  if (isSettingsPath(pathname)) {
    return <div data-settings-content className="mx-auto w-full min-w-0 max-w-3xl pt-6 sm:pt-12">{children}</div>
  }
  const titleMode = pageTitle && !isSidebarlessRoute(pathname) ? desktopTitleMode(pathname) : "none"
  // Yalnız masaüstünde (lg+) çizilir; altında başlık bardadır.
  const desktopTitle = titleMode === "none" ? null : (
    // cn() değil: tailwind-merge özel `text-page-title`ı renk sınıfı sanıp
    // `text-foreground` lehine siler.
    <h1 className={titleMode === "visible" ? "hidden text-page-title text-foreground lg:mb-6 lg:block" : "sr-only hidden lg:block"}>
      {pageTitle}
    </h1>
  )
  if (wide) return <div className={WIDE_WIDTH_CLASS}>{desktopTitle}{children}</div>
  if (constrained) return <div className={CONSTRAINED_WIDTH_CLASS}>{desktopTitle}{children}</div>
  return <>{desktopTitle}{children}</>
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const inSettings = isSettingsPath(pathname)
  // Teknisyen paneli ve oradan açılan akışlar (bkz. lib/sidebarless-route.ts).
  const hideSidebar = isSidebarlessRoute(pathname, searchParams)
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)
  const primaryNavigation = (isTechRole ? TECHNICIAN_NAV_GROUPS : NAV_GROUPS)
    .flatMap((group) => group.items.flatMap((item) => [
      item,
      ...(item.children ?? []).map((child) => ({ ...child, feature: child.feature ?? item.feature })),
    ]))
  const settingsNavigation = isTechRole
    ? ACCOUNT_SETTINGS_ITEMS
    : SETTINGS_NAV_GROUPS.flatMap((group) => group.items)
  const visibleSettingsNavigation = settingsNavigation.filter((item) =>
    !item.manageOnly || (userIdentity && actorCan(userIdentity, "settings.manage")))
  const searchNavigation: SearchDestination[] = [...primaryNavigation, ...visibleSettingsNavigation]

  return (
    <SetPageHeaderContext.Provider value={setPageHeader}>
      <SidebarProvider defaultOpen={!initialSidebarCollapsed}>
        {hideSidebar ? null : (
          <AppSidebar
            enabledFeatures={enabledFeatures}
            userIdentity={userIdentity}
            planStatus={planStatus}
            workspace={workspace}
            showGlobalSearch={pageHeader.showGlobalSearch ?? true}
            topBannerVisible={topBannerVisible}
            onOpenSearch={() => setSearchOpen(true)}
          />
        )}
        <SidebarInset className="min-h-screen bg-background">
          <AppHeader pageHeader={pageHeader} userIdentity={userIdentity} topBannerVisible={topBannerVisible} />
          <main className={cn("flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:pb-8", inSettings && "bg-card")}>{children}</main>
        </SidebarInset>
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
  const searchParams = useSearchParams()
  const navItem = [...NAV_GROUPS, ...TECHNICIAN_NAV_GROUPS]
    .flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]))
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  const settingsNavItem = SETTINGS_NAV_GROUPS
    .flatMap((group) => group.items)
    .find((item) => matchesSettingsNavItem(item, pathname))
  const headerTitle = pageTitle || navItem?.label || (isSettingsPath(pathname) ? "Ayarlar" : undefined)
  const HeaderIcon = settingsNavItem?.icon ?? navItem?.icon
  const isTechRole = isTechnicianRestrictedRole(userIdentity?.role)
  const showMobileTitle = headerTitle && !isSettingsPath(pathname) && !MOBILE_CONTENT_HEADING_PATHS.has(pathname)
  const sidebarless = isSidebarlessRoute(pathname, searchParams)
  const homeHref = isTechRole ? "/technician" : "/dashboard"
  const contentOwnsTitle = CONTENT_H1_PATHS.has(pathname)

  return (
    <header
      className={cn(
        // Mobil/tablet (<lg) 58px bar + 44px düğme: e-santral "sticky üst bar"
        // ölçüsü (docs/design-pattern-esantral.md §Sticky üst bar). Masaüstünde
        // yalnız sidebar kapalıyken açma düğmesi için kompakt 48px görünür.
        "sticky top-0 z-30 flex h-[58px] items-center border-b border-border bg-background lg:h-12",
        shellStyles.header,
        topBannerVisible && "lg:top-8",
        !sidebarless && "lg:group-data-[sidebar-state=expanded]/sidebar-wrapper:hidden",
      )}
    >
      <div className="relative flex h-full w-full flex-nowrap items-center gap-2 px-4">
        {/* Sidebar açıkken kontrol menü başlığındadır; kapalıyken burada görünür. */}
        {sidebarless ? (
          <Link href={homeHref} aria-label="BakimX" className="hidden items-center md:flex">
            <BrandLogo variant="icon-light" size="md" priority alt="BakimX" />
          </Link>
        ) : (
          <SidebarTrigger
            data-tour="sidebar-trigger"
            className="-ml-2 size-11 lg:size-8 [&_svg:not([class*='size-'])]:size-[22px] lg:[&_svg:not([class*='size-'])]:size-4 lg:group-data-[sidebar-state=expanded]/sidebar-wrapper:hidden"
          />
        )}

        {showMobileTitle ? (
          <h1 className={cn("min-w-0 flex-1 truncate text-sm font-semibold leading-5 tracking-[-0.07px] text-foreground md:hidden", shellStyles.headerTitle)}>
            {headerTitle}
          </h1>
        ) : (
          // Başlığı içerikte olan sayfada barda başlık hiç yazmaz; logo tablette de
          // (md–lg) kalır, yoksa bar tek bir menü düğmesiyle boş görünür.
          <div className={cn("absolute left-1/2 -translate-x-1/2", contentOwnsTitle ? "lg:hidden" : "md:hidden")}>
            <Link href={homeHref} aria-label="BakimX" className="flex items-center">
              <BrandLogo variant="icon-light" size="lg" priority alt="BakimX" />
            </Link>
          </div>
        )}

        {headerTitle && !contentOwnsTitle && (
          // Masaüstünde başlık içerikte (AppShell); sidebar'sız ekranda bar kalır.
          <h1 className={cn("hidden min-w-0 items-center gap-2 truncate text-sm font-semibold leading-5 tracking-[-0.07px] text-foreground md:flex", !sidebarless && "lg:hidden", shellStyles.headerTitle)}>
            {HeaderIcon ? <HeaderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            <span className="truncate">{headerTitle}</span>
          </h1>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {isTechRole ? <div className={sidebarless ? undefined : "lg:hidden"}><TechnicianNotificationsBell /></div> : null}
          <div className="md:hidden">{pageActions}</div>
          {sidebarless && isTechRole ? <SidebarlessAccountActions /> : null}
        </div>
      </div>
    </header>
  )
}

// Sidebar'sız ekranda teknisyenin hesap ve çıkış yolu. Telefonda "Profil" alt
// gezintide durduğu için yalnız geniş ekranda gösterilir; çıkış her genişlikte.
function SidebarlessAccountActions() {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 lg:size-8" asChild>
            <Link href="/settings/account" aria-label="Hesap ayarları">
              <UserCircle className="size-[22px] lg:size-4" aria-hidden="true" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Hesap ayarları</TooltipContent>
      </Tooltip>
      <form action="/api/auth/logout" method="POST">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" variant="ghost" size="icon" className="size-11 lg:size-8" aria-label="Çıkış Yap">
              <LogOut className="size-[22px] lg:size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Çıkış Yap</TooltipContent>
        </Tooltip>
      </form>
    </>
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
    <Sidebar collapsible="offcanvas" className={cn(inSettings ? settingsSidebarStyles.sidebar : shellStyles.sidebar, topBannerVisible && "lg:top-8! lg:h-[calc(100svh-2rem)]!")}>
      <SidebarHeader className={cn("flex-row items-center border-b border-sidebar-border", inSettings ? "h-[49px] gap-3 px-3 py-0 pr-10" : "gap-1 p-2")}>
        {inSettings ? (
          <>
            <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
              <Link
                href={isTechRole ? "/technician" : "/dashboard"}
                aria-label="Ana menüye dön"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <span className="min-w-0 truncate text-base font-semibold leading-5 tracking-[-0.01em] text-foreground">Ayarlar</span>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            {workspace && !isTechRole ? (
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
        )}
        {!inSettings ? <SidebarTrigger className="hidden shrink-0 lg:inline-flex" /> : null}
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
                className={cn("h-7 w-full justify-start gap-2 truncate px-2 text-sm font-medium leading-5 tracking-[-0.005em]", shellStyles.search)}
                aria-label="Genel arama"
              >
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left">Ara</span>
                <span className={cn("hidden shrink-0 rounded-sm border border-border px-1 text-[11px] leading-4 text-muted-foreground xl:inline", shellStyles.searchKey)}>⌘ K</span>
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
          <SettingsNav enabledFeatures={enabledFeatures} role={userIdentity?.role} teamPermissions={userIdentity?.teamPermissions} />
        ) : (
          visibleGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
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
              <SidebarMenuButton asChild tooltip={`${planStatus.title} · ${planStatus.detail}`} className={cn("h-auto py-1.5 group-data-[collapsible=icon]:size-7!", shellStyles.plan)}>
                <Link href="/settings/plans">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm font-medium leading-5 tracking-[-0.005em]">{planStatus.title}</span>
                    <span className="block truncate text-xs leading-4 text-muted-foreground">{planStatus.detail}</span>
                  </span>
                  <span className={cn("rounded-md border border-sidebar-border px-1.5 py-1 text-[10px] group-data-[collapsible=icon]:hidden", shellStyles.planAction)}>{planStatus.action}</span>
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
            <SidebarMenuSubButton asChild isActive={pathname === item.href} className="text-sm leading-5 tracking-[-0.005em]">
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
