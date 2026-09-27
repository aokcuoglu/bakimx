"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addTeamMembersAction,
  removeTeamMemberAction,
} from "@/app/(app)/settings/members-and-teams/teams/actions"

export type TeamMemberRow = {
  id: string
  name: string
  identity: string
}

export function TeamMembersPanel({
  teamId,
  members,
  candidates,
  canManage,
}: {
  teamId: string
  members: TeamMemberRow[]
  candidates: TeamMemberRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [pending, start] = useTransition()

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-16 text-center">
        <UserRound className="size-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium text-foreground">Üye yok</p>
        <p className="mt-1 text-sm text-muted-foreground">Bu ekibe henüz üye eklemediniz.</p>
        {canManage ? (
          <Button type="button" variant="foreground" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            Üye ekle
          </Button>
        ) : null}
        {picker()}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button type="button" variant="foreground" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            Üye ekle
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
              <p className="truncate text-xs text-muted-foreground">{member.identity}</p>
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await removeTeamMemberAction(teamId, member.id)
                    if (!result.ok) {
                      toast.error(result.error)
                      return
                    }
                    router.refresh()
                  })
                }}
              >
                Çıkar
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {picker()}
    </div>
  )

  function picker() {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Üye ekle</DialogTitle>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Eklenebilecek başka üye yok.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {candidates.map((candidate) => (
                <label key={candidate.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={picked.includes(candidate.id)}
                    onCheckedChange={(value) => {
                      setPicked((current) =>
                        value === true
                          ? [...current, candidate.id]
                          : current.filter((id) => id !== candidate.id),
                      )
                    }}
                  />
                  <span>
                    <span className="block text-foreground">{candidate.name}</span>
                    <span className="block text-xs text-muted-foreground">{candidate.identity}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button
              type="button"
              variant="foreground"
              disabled={pending || picked.length === 0}
              onClick={() => {
                start(async () => {
                  const result = await addTeamMembersAction(teamId, picked)
                  if (!result.ok) {
                    toast.error(result.error)
                    return
                  }
                  setPicked([])
                  setOpen(false)
                  router.refresh()
                })
              }}
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
