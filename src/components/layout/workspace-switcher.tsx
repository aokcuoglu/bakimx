"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, ChevronsUpDown, LockKeyhole, Plus } from "lucide-react"
import { toast } from "sonner"
import { CreateBranchWizard } from "@/components/branches/create-branch-wizard"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                tooltip={current.name}
                aria-label={`Şube: ${current.name}${current.city ? `, ${current.city}` : ""}`}
              >
                <WorkspaceAvatar name={current.name} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{current.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{current.city}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">Şubeler</DropdownMenuLabel>
              {memberships.map((item) => {
                const active = item.id === currentWorkshopId
                return (
                  <DropdownMenuItem
                    key={item.id}
                    className="gap-2 p-2"
                    disabled={pending}
                    aria-label={`${item.name}${item.city ? `, ${item.city}` : ""}${active ? " (aktif)" : ""}`}
                    onSelect={(event) => {
                      event.preventDefault()
                      switchTo(item.id)
                    }}
                  >
                    <WorkspaceAvatar name={item.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.city}</p>
                    </div>
                    {active ? <Check className="size-4 shrink-0 text-foreground" aria-hidden /> : null}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              {canCreateBranch ? (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onSelect={(event) => {
                    event.preventDefault()
                    setOpen(false)
                    setWizardOpen(true)
                  }}
                >
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background">
                    <Plus className="size-4" />
                  </span>
                  <span className="text-sm font-medium">Yeni şube oluştur</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild className="gap-2 p-2">
                  <a href="/account/plans">
                    <span className="flex size-7 items-center justify-center rounded-md border border-border bg-muted">
                      <LockKeyhole className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Yeni şube</span>
                      <span className="block text-xs text-muted-foreground">Premium pakette</span>
                    </span>
                  </a>
                </DropdownMenuItem>
              )}
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
