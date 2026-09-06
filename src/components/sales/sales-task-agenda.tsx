"use client"

import Link from "next/link"
import { useTransition } from "react"
import { CalendarCheck2, Clock3, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { resolveSalesTask } from "@/app/admin/sales/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { salesLeadAdminHref } from "@/lib/sales/links"

export type AgendaTask = {
  id: string
  type: string
  startsAt: string
  durationMinutes: number
  note: string | null
  overdue: boolean
  lead: { id: string; businessName: string; contactName: string }
  advisorName: string | null
}

const TASK_LABELS: Record<string, string> = {
  call: "Arama",
  visit: "Ziyaret",
  online_demo: "Online demo",
  follow_up: "Takip",
}

function formatTaskTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SalesTaskAgenda({ tasks, canManage }: { tasks: AgendaTask[]; canManage: boolean }) {
  const [pending, startTransition] = useTransition()
  const overdue = tasks.filter((task) => task.overdue)
  const today = tasks.filter((task) => !task.overdue)

  function resolve(taskId: string, status: "cancelled" | "no_show") {
    startTransition(async () => {
      const result = await resolveSalesTask(taskId, status)
      if (!result.ok) toast.error(result.error)
      else toast.success(status === "cancelled" ? "Görev iptal edildi." : "Görev gelmedi olarak işaretlendi.")
    })
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <CalendarCheck2 className="size-4 text-primary" /> Bugünüm
          </h2>
          <p className="text-sm text-muted-foreground">Europe/Istanbul saatine göre geciken ve bugünkü görevler.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/sales/leads">Tüm adaylar</Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Bugün için planlanmış veya gecikmiş görev yok.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {[{ label: "Geciken", items: overdue, overdue: true }, { label: "Bugün", items: today, overdue: false }].map((bucket) => (
            <div key={bucket.label} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {bucket.overdue ? <TriangleAlert className="size-4 text-warning-strong" /> : <Clock3 className="size-4 text-primary" />}
                {bucket.label} <Badge variant="secondary">{bucket.items.length}</Badge>
              </h3>
              {bucket.items.length === 0 ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Kayıt yok.</p>
              ) : bucket.items.map((task) => (
                <article key={task.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Button asChild variant="link" className="h-auto justify-start p-0 font-semibold">
                        <Link href={`${salesLeadAdminHref(task.lead.id)}?task=${encodeURIComponent(task.id)}#activity-form`}>
                          {task.lead.businessName}
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">{task.lead.contactName} · {TASK_LABELS[task.type] ?? task.type}</p>
                    </div>
                    <Badge variant={task.overdue ? "destructive" : "outline"}>{formatTaskTime(task.startsAt)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{task.durationMinutes} dk{task.advisorName ? ` · ${task.advisorName}` : ""}</p>
                  {task.note && <p className="mt-1 text-sm text-foreground">{task.note}</p>}
                  {canManage && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`${salesLeadAdminHref(task.lead.id)}?task=${encodeURIComponent(task.id)}#activity-form`}>Görüşmeyle tamamla</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => resolve(task.id, "no_show")}>Gelmedi</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => resolve(task.id, "cancelled")}>İptal</Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
