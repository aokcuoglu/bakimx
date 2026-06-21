"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HardHat, Wrench, Clock, AlertTriangle } from "lucide-react"
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

export function TechnicianStatusWidget({ technicians }: { technicians: TechnicianRow[] }) {
  if (technicians.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <HardHat className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Usta İş Durumu</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <p>Henüz teknisyen kaydı yok</p>
          <Link href="/app/workshop" className="text-primary hover:underline text-sm mt-1 inline-block">
            İş Yeri Profili sayfasından ekleyin
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardHat className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Usta İş Durumu</h3>
        </div>
        <Link
          href="/app/technician"
          className="text-xs text-primary hover:underline"
        >
          Tümünü Gör
        </Link>
      </div>

      <div className="space-y-3">
        {technicians.map((t) => {
          const roleInfo = (TECHNICIAN_ROLES as Record<string, { label: string; color: string }>)[t.role]
          return (
            <div key={t.id} className="flex items-start gap-3 py-2">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <HardHat className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{t.fullName}</span>
                  <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", roleInfo?.color || "bg-muted text-muted-foreground")}>
                    {roleInfo?.label || t.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="size-3" />
                      {t.delayedJobs} gecikmiş
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}