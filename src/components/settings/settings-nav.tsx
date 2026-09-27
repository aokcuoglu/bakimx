"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { LockKeyhole, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import {
  ACCOUNT_SETTINGS_ITEMS,
  SETTINGS_NAV_GROUPS,
  type SettingsNavItem,
} from "@/lib/settings-nav"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import type { UserRole } from "@prisma/client"

export function SettingsNav({
  enabledFeatures = [],
  role,
}: {
  enabledFeatures?: GatedFeature[]
  role?: UserRole
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
      items: group.items.filter((item) => item.label.toLocaleLowerCase("tr").includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0)

  function closeMobile() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <div className="relative border-b border-sidebar-border px-3 py-3">
        <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <SidebarInput
          aria-label="Ayarlarda ara"
          placeholder="Ayarlarda ara..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8 text-sm leading-5 tracking-[-0.005em]"
        />
      </div>

      {visibleGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-xs leading-4 tracking-normal">{group.label}</SidebarGroupLabel>
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
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const isLocked = Boolean(item.feature && !enabledFeatures.includes(item.feature))

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={isLocked ? `${item.label} · Profesyonel` : item.label}
        className="h-9 text-sm leading-5 font-medium tracking-[-0.005em]"
      >
        <Link href={item.href} onClick={onNavigate}>
          <Icon className="size-4" />
          <span className="flex-1">{item.label}</span>
          {isLocked ? (
            <>
              <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] group-data-[collapsible=icon]:hidden">
                PRO
              </Badge>
            </>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
