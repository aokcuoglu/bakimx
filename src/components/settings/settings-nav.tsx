"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LockKeyhole, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

  const groups = isTechRole
    ? [{ label: "Hesap ayarları", items: ACCOUNT_SETTINGS_ITEMS.filter((i) => i.href === "/settings/profile") }]
    : SETTINGS_NAV_GROUPS

  function closeMobile() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <>
      <SidebarGroup className="pb-0">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Ayarları kapat">
                <Link href="/dashboard" onClick={closeMobile} aria-label="Ayarları kapat">
                  <X className="size-4" />
                  <span>Kapat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {groups.map((group) => (
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
