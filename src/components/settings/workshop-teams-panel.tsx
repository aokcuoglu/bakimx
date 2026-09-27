"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Plus, Search, Users } from "lucide-react"
import { InstantLink } from "@/components/settings/instant-link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WorkshopTeamRecord } from "@/lib/workshop-teams"
import {
  deleteWorkshopTeamAction,
  saveWorkshopTeamAction,
} from "@/app/(app)/settings/members-and-teams/teams/actions"

export function WorkshopTeamsPanel({
  teams,
  canManage,
}: {
  teams: WorkshopTeamRecord[]
  canManage: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, start] = useTransition()

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr")
    if (!needle) return teams
    return teams.filter((team) => team.name.toLocaleLowerCase("tr").includes(needle))
  }, [query, teams])

  function create() {
    start(async () => {
      const result = await saveWorkshopTeamAction({ name, description, permissions: [] })
      if (!result.ok || !result.id) {
        toast.error(result.ok ? "Ekip oluşturulamadı." : result.error)
        return
      }
      setOpen(false)
      setName("")
      setDescription("")
      router.push(`/settings/members-and-teams/teams/${result.id}`)
    })
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara"
            className="pl-8"
          />
        </div>
        {canManage ? (
          <Button type="button" variant="foreground" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            Yeni ekip
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_6rem_6rem_2.5rem] items-center gap-3 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> Ekip</span>
          <span>Üye</span>
          <span>Kullanım</span>
          <span />
        </div>
        {visible.length === 0 ? (
          <p className="px-3 py-8 text-sm text-muted-foreground">Ekip bulunamadı.</p>
        ) : visible.map((team) => (
          <div
            key={team.id}
            className="grid grid-cols-[1fr_6rem_6rem_2.5rem] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/60"
          >
            <InstantLink
              href={`/settings/members-and-teams/teams/${team.id}`}
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-warning/15 text-[11px] font-semibold text-warning-strong">
                {team.name.slice(0, 1).toLocaleUpperCase("tr")}
              </span>
              <span className="truncate text-sm font-medium text-foreground">{team.name}</span>
            </InstantLink>
            <InstantLink href={`/settings/members-and-teams/teams/${team.id}/members`} className="text-sm text-foreground">
              {team.memberCount}
            </InstantLink>
            <InstantLink href={`/settings/members-and-teams/teams/${team.id}/usage`} className="text-sm text-foreground">
              {team.permissions.length}
            </InstantLink>
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Ekip işlemleri">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      start(async () => {
                        const result = await deleteWorkshopTeamAction(team.id)
                        if (!result.ok) {
                          toast.error(result.error)
                          return
                        }
                        toast.success("Ekip silindi.")
                        router.refresh()
                      })
                    }}
                  >
                    Ekibi sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : <span />}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni ekip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="new-team-name" className="text-xs font-medium text-muted-foreground">Ekip adı</label>
              <Input id="new-team-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-team-description" className="text-xs font-medium text-muted-foreground">Açıklama</label>
              <Textarea id="new-team-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button type="button" variant="foreground" disabled={pending} onClick={create}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
