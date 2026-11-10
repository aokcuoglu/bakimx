"use client"

import Link from "next/link"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { HardHat, Wrench, Clock, AlertTriangle, ChevronRight } from "lucide-react"
import { TECHNICIAN_ROLES } from "@/lib/constants"

type TechnicianRow = {
  id: string
  fullName: string
  phone: string
  role: string
  activeJobs: number
  inProgressJobs: number
  delayedJobs: number
  completedToday: number
}

export function TechnicianStatusWidget({
  technicians,
  unassignedCount = 0,
}: {
  technicians: TechnicianRow[]
  /** Ustası olmayan aktif iş sayısı — dağıtım bekleyen iş kuyruğu. */
  unassignedCount?: number
}) {
  return (
    <section aria-label="Usta iş durumu" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Usta İş Durumu</h3>
        {technicians.length > 0 && (
          <Link href="/technician" className="text-xs font-medium text-primary hover:underline">Tümünü Gör</Link>
        )}
      </div>

      {technicians.length > 0 && unassignedCount > 0 && (
        <div className="px-4 pt-3 pb-1">
          <Alert variant="warning">
            <AlertTriangle aria-hidden className="size-4" />
            <AlertTitle>
              <Link href="/orders?technician=none" className="flex items-center justify-between gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>Atanmamış iş</span>
                <span className="font-semibold tabular-nums">{unassignedCount}</span>
              </Link>
            </AlertTitle>
          </Alert>
        </div>
      )}

      {technicians.length === 0 && (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          <p>Henüz teknisyen kaydı yok</p>
          <Link href="/settings/team" className="mt-1 inline-block text-sm text-primary hover:underline">Ayarlar → Ekip sayfasından ekleyin</Link>
        </div>
      )}

      <div className="divide-y divide-border">
        {technicians.map((t) => {
          const roleInfo = (TECHNICIAN_ROLES as Record<string, { label: string; color: string }>)[t.role]
          return (
            <Link
              key={t.id}
              href={`/orders?technician=${t.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <HardHat className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{t.fullName}</span>
                  <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium border", roleInfo?.color || "bg-muted text-muted-foreground")}>
                    {roleInfo?.label || t.role}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wrench className="size-3" />
                    {t.activeJobs} aktif
                  </span>
                  {t.inProgressJobs > 0 && (
                    <span className="flex items-center gap-1 text-primary">
                      <Clock className="size-3" />
                      {t.inProgressJobs} işlemde
                    </span>
                  )}
                  {t.delayedJobs > 0 && (
                    <span className="flex items-center gap-1 text-warning-strong">
                      <AlertTriangle className="size-3" />
                      {t.delayedJobs} gecikmiş
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
