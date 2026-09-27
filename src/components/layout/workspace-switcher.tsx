"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { Building2, Check, ChevronsUpDown, LockKeyhole, LogOut, Plus, UserCircle, UserRoundPlus } from "lucide-react"
import { toast } from "sonner"
import { CreateBranchWizard } from "@/components/branches/create-branch-wizard"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { MembershipWorkshopSummary } from "@/lib/membership"

export type WorkspaceSwitcherItem = MembershipWorkshopSummary & {
  role: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

function WorkspaceAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-muted text-[10px] font-semibold text-foreground",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function WorkspaceSwitcher({
  currentWorkshopId,
  memberships,
  canCreateBranch,
}: {
  currentWorkshopId: string
  memberships: WorkspaceSwitcherItem[]
  canCreateBranch: boolean
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const [open, setOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const current = useMemo(
    () => memberships.find((m) => m.id === currentWorkshopId) ?? memberships[0],
    [memberships, currentWorkshopId],
  )

  if (!current) return null
  const canInviteMembers = current.role === "owner" || current.role === "manager"

  function switchTo(workshopId: string) {
    if (workshopId === currentWorkshopId || pending) return
    startTransition(async () => {
      try {
        const res = await fetch("/api/branches/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshopId }),
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          toast.error(body.error || "Şube değiştirilemedi.")
          return
        }
        setOpen(false)
        if (isMobile) setOpenMobile(false)
        window.location.assign("/dashboard")
      } catch {
        toast.error("Şube değiştirilemedi.")
      }
    })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="text-[clamp(18px,calc(var(--sidebar-width)*0.06),20px)] font-semibold leading-6 tracking-[-0.02em]"
                tooltip={current.name}
                aria-label={`Şube: ${current.name}`}
              >
                <WorkspaceAvatar name={current.name} />
                <div className="grid min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                  <span className="truncate">{current.name}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              aria-label="Çalışma alanı menüsü"
              className="w-[min(24rem,calc(100vw-1rem))] rounded-xl border border-border bg-card p-1.5 shadow-lg"
              align="start"
              side="bottom"
              sideOffset={12}
            >
              {memberships.map((item) => {
                const active = item.id === currentWorkshopId
                return (
                  <DropdownMenuItem
                    key={item.id}
                    className="min-h-12 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70"
                    disabled={pending}
                    aria-label={`${item.name}${item.city ? `, ${item.city}` : ""}${active ? " (aktif)" : ""}`}
                    onSelect={(event) => {
                      event.preventDefault()
                      switchTo(item.id)
                    }}
                  >
                    <WorkspaceAvatar name={item.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium leading-6 tracking-[-0.01em]">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.city}</p>
                    </div>
                    {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </DropdownMenuItem>
                )
              })}
              {canCreateBranch ? (
                <DropdownMenuItem
                  className="min-h-11 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70"
                  onSelect={(event) => {
                    event.preventDefault()
                    setOpen(false)
                    setWizardOpen(true)
                  }}
                >
                  <span className="flex size-7 items-center justify-center">
                    <Plus className="size-4" />
                  </span>
                  <span className="text-base font-medium leading-6 tracking-[-0.01em]">Yeni şube oluştur</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild className="min-h-11 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70">
                  <Link
                    href="/settings/plans"
                    onClick={() => {
                      setOpen(false)
                      if (isMobile) setOpenMobile(false)
                    }}
                  >
                    <span className="flex size-7 items-center justify-center">
                      <LockKeyhole className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium leading-6 tracking-[-0.01em]">Yeni şube</span>
                      <span className="block text-xs text-muted-foreground">Premium pakette</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="min-h-10 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70">
                <Link
                  href="/settings/account"
                  aria-label="Hesap ayarları"
                  onClick={() => {
                    setOpen(false)
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <UserCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-base leading-6 tracking-[-0.01em]">Hesap ayarları</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-10 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70">
                <Link
                  href="/settings/general"
                  aria-label="Çalışma alanı ayarları"
                  onClick={() => {
                    setOpen(false)
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-base leading-6 tracking-[-0.01em]">Çalışma alanı ayarları</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canInviteMembers ? (
                <>
                  <DropdownMenuItem asChild className="min-h-10 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70">
                    <Link
                      href="/settings/team?invite=1"
                      onClick={() => {
                        setOpen(false)
                        if (isMobile) setOpenMobile(false)
                      }}
                    >
                      <UserRoundPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-base leading-6 tracking-[-0.01em]">Üyeleri davet et</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <form id="workspace-switcher-logout" action="/api/auth/logout" method="POST" className="hidden" />
              <DropdownMenuItem
                className="min-h-10 gap-3 rounded-lg px-3 py-2 focus:bg-muted/70"
                aria-label="Çıkış yap"
                onSelect={(event) => {
                  event.preventDefault()
                  const form = document.getElementById("workspace-switcher-logout") as HTMLFormElement | null
                  form?.requestSubmit()
                }}
              >
                <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-base leading-6 tracking-[-0.01em]">Çıkış yap</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateBranchWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  )
}

/** Compact trigger used when SidebarMenuButton size helpers differ. */
export function WorkspaceSwitcherFallbackNotice() {
  return (
    <Button type="button" variant="ghost" size="sm" className="w-full justify-start" disabled>
      Şube yok
    </Button>
  )
}
