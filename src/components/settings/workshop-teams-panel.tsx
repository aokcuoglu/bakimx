"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { MoreHorizontal, Plus, Search, Settings2, Users } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { InstantLink } from "@/components/settings/instant-link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
import { createWorkshopTeamSchema } from "@/lib/validations/workshop-team"
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
  const [pending, start] = useTransition()
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const form = useForm<z.infer<typeof createWorkshopTeamSchema>>({
    resolver: zodResolver(createWorkshopTeamSchema),
    defaultValues: { name: "", description: "" },
  })

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr")
    if (!needle) return teams
    return teams.filter((team) => team.name.toLocaleLowerCase("tr").includes(needle))
  }, [query, teams])

  function create(values: z.infer<typeof createWorkshopTeamSchema>) {
    start(async () => {
      const result = await saveWorkshopTeamAction({ ...values, permissions: [] })
      if (!result.ok || !result.id) {
        toast.error(result.ok ? "Ekip oluşturulamadı." : result.error)
        return
      }
      setOpen(false)
      form.reset()
      router.push(`/settings/members-and-teams/teams/${result.id}`)
    })
  }

  return (
    <div className="mt-10 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Ekiplerde ara"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara"
            className="pl-8"
          />
        </div>
        {canManage ? (
          <Button ref={createButtonRef} type="button" variant="foreground" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Yeni ekip
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem] items-center gap-3 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
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
            className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-border px-3 py-3 last:border-b-0 hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem] sm:gap-3 sm:py-2"
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
            <div className="col-span-2 flex gap-4 pl-8 sm:contents">
              <InstantLink href={`/settings/members-and-teams/teams/${team.id}/members`} className="text-xs text-muted-foreground hover:text-foreground sm:text-sm sm:text-foreground">
                <span className="sm:hidden">Üye: </span>{team.memberCount}
              </InstantLink>
              <InstantLink href={`/settings/members-and-teams/teams/${team.id}/usage`} className="text-xs text-muted-foreground hover:text-foreground sm:text-sm sm:text-foreground">
                <span className="sm:hidden">Kullanım: </span>{team.permissions.length}
              </InstantLink>
            </div>
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" className="col-start-2 row-start-1 sm:col-auto sm:row-auto" aria-label="Ekip işlemleri">
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

      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) form.reset()
      }}>
        <DialogContent
          overlayClassName="bg-foreground/25"
          className="gap-0 p-0 sm:top-[calc(15vh-0.375rem)] sm:max-w-[700px] sm:translate-y-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            createButtonRef.current?.focus()
          }}
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(create)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !pending) {
                  event.preventDefault()
                  void form.handleSubmit(create)()
                }
              }}
            >
              <DialogHeader className="px-4 py-3 pr-10">
                <DialogTitle className="text-sm font-medium">Yeni ekip</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 px-4 pt-4 pb-6 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="min-w-0 gap-1">
                    <FormLabel className="text-xs font-medium text-muted-foreground">Ekip adı</FormLabel>
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-warning-strong">
                        <Settings2 className="size-4" />
                      </span>
                      <FormControl><Input {...field} placeholder="Ekip adını girin" maxLength={40} /></FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="min-w-0 gap-1">
                    <FormLabel className="text-xs font-medium text-muted-foreground">Ekip açıklaması</FormLabel>
                    <FormControl><Input {...field} placeholder="Ekip açıklamasını girin" maxLength={160} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="mx-0 mb-0 rounded-none border-border px-2 py-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>
                  Vazgeç <kbd aria-hidden="true" className="ml-1 rounded border border-border px-1 text-[10px] font-normal leading-4 text-muted-foreground">Esc</kbd>
                </Button>
                <Button type="submit" variant="foreground" disabled={pending}>
                  Oluştur <span aria-hidden="true" className="ml-1 flex gap-0.5 text-xs font-normal text-primary-foreground"><kbd className="rounded border border-primary-foreground/20 px-1 leading-4">⌘</kbd><kbd className="rounded border border-primary-foreground/20 px-1 leading-4">↵</kbd></span>
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
