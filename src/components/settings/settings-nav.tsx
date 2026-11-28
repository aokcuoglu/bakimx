"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { LockKeyhole, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import shellStyles from "@/components/layout/app-shell.module.css"
import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { GatedFeature } from "@/lib/plan"
import { lockedFeatureLabels } from "@/lib/feature-catalog"
import { LockedBadgeText } from "@/components/billing/locked-badge-text"
import {
  ACCOUNT_SETTINGS_ITEMS,
  SETTINGS_NAV_GROUPS,
  matchesSettingsNavItem,
  type SettingsNavItem,
} from "@/lib/settings-nav"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { actorCan, type Permission } from "@/lib/roles"
import type { UserRole } from "@prisma/client"

export function SettingsNav({
  enabledFeatures = [],
  role,
  teamPermissions,
}: {
  enabledFeatures?: GatedFeature[]
  role?: UserRole
  teamPermissions?: Permission[] | null
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const isTechRole = isTechnicianRestrictedRole(role)
  const [query, setQuery] = useState("")

  const groups = isTechRole
    ? [{ label: "Kişisel", items: ACCOUNT_SETTINGS_ITEMS }]
    : SETTINGS_NAV_GROUPS
  const normalizedQuery = query.trim().toLocaleLowerCase("tr")
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (!item.manageOnly || (role && actorCan({ role, teamPermissions }, "settings.manage"))) &&
        item.label.toLocaleLowerCase("tr").includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0)

  function closeMobile() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <div className="relative px-3 py-2">
        <Search className="pointer-events-none absolute left-[22px] top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <SidebarInput
          aria-label="Ayarlarda ara"
          placeholder="Ayarlarda ara..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(shellStyles.search, shellStyles.searchInput)}
        />
      </div>

      {visibleGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SettingsNavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  enabledFeatures={enabledFeatures}
                  onNavigate={closeMobile}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
      {visibleGroups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Eşleşen ayar bulunamadı.</p>
      ) : null}
    </>
  )
}

function SettingsNavLink({
  item,
  pathname,
  enabledFeatures,
  onNavigate,
}: {
  item: SettingsNavItem
  pathname: string
  enabledFeatures: GatedFeature[]
  onNavigate: () => void
}) {
  const Icon = item.icon
  const isActive = matchesSettingsNavItem(item, pathname)
  const isLocked = Boolean(item.feature && !enabledFeatures.includes(item.feature))

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={isLocked && item.feature ? `${item.label} · ${lockedFeatureLabels(item.feature).description}` : item.label}
      >
        <Link href={item.href} onClick={onNavigate}>
          <Icon />
          <span className="flex-1">{item.label}</span>
          {isLocked ? (
            <>
              <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] group-data-[collapsible=icon]:hidden">
                {item.feature && <LockedBadgeText feature={item.feature} />}
              </Badge>
            </>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
