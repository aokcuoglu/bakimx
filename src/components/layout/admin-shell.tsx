"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/shared/brand-logo"
import {
  Sidebar,
  SidebarContent as SidebarContentSlot,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AdminNav } from "@/app/admin/admin-nav"
import type { AdminCapability } from "@/lib/admin-roles"

type AdminShellProps = {
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
  liveChatUnanswered?: number
  capabilities?: AdminCapability[]
  userName?: string
  userRoleLabel?: string
}

export function AdminShell({
  children,
  initialSidebarCollapsed = false,
  liveChatUnanswered = 0,
  capabilities = [],
  userName,
  userRoleLabel,
}: AdminShellProps) {
  return (
    <SidebarProvider defaultOpen={!initialSidebarCollapsed}>
      <AdminSidebar
        liveChatUnanswered={liveChatUnanswered}
        capabilities={capabilities}
        userName={userName}
        userRoleLabel={userRoleLabel}
      />
      <SidebarInset>
        <AdminHeader />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AdminSidebar({
  liveChatUnanswered,
  capabilities,
  userName,
  userRoleLabel,
}: {
  liveChatUnanswered: number
  capabilities: AdminCapability[]
  userName?: string
  userRoleLabel?: string
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <Link
          href="/admin"
          aria-label="BakimX Yönetim"
          className="flex size-8 items-center justify-center"
        >
          <BrandLogo variant="icon-dark" size="sm" priority alt="BakimX Yönetim" />
        </Link>
      </SidebarHeader>

      <SidebarContentSlot>
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <AdminNav
                liveChatUnanswered={liveChatUnanswered}
                capabilities={capabilities}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContentSlot>

      <SidebarFooter className="border-t border-sidebar-border">
        {userName && (
          <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{userName}</p>
            {userRoleLabel && (
              <p className="truncate text-xs text-sidebar-foreground/60">{userRoleLabel}</p>
            )}
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <SidebarTrigger className="-ml-2" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground sm:text-lg">Yönetim Paneli</p>
          <p className="hidden text-xs text-muted-foreground sm:block">BakımX platform operasyonları</p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/dashboard">Uygulamaya dön</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
