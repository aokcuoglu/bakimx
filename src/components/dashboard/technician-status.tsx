"use client"

import { AlertTriangle } from "lucide-react"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { DashEmpty, DashPanel, DashPill, DashRow, DashTile, initials } from "@/components/dashboard/surface"

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
    <DashPanel
      title="Usta iş durumu"
      action={technicians.length > 0 ? { href: "/technician", label: "Tümünü gör" } : undefined}
    >
      {technicians.length === 0 ? (
        <DashEmpty>Henüz teknisyen kaydı yok. Ayarlar → Ekip sayfasından ekleyin.</DashEmpty>
      ) : (
        <>
          {unassignedCount > 0 && (
            <DashRow
              href="/orders?technician=none"
              start={<DashTile tone="warning"><AlertTriangle /></DashTile>}
              title="Atanmamış iş"
              sub="Usta bekleyen aktif araç kabulleri"
              end={<DashPill tone="warning">{unassignedCount}</DashPill>}
            />
          )}
          {technicians.map((t) => {
            const roleLabel = (TECHNICIAN_ROLES as Record<string, { label: string }>)[t.role]?.label || t.role
            const parts = [roleLabel, `${t.activeJobs} aktif`]
            if (t.inProgressJobs > 0) parts.push(`${t.inProgressJobs} işlemde`)
            return (
              <DashRow
                key={t.id}
                href={`/orders?technician=${t.id}`}
                start={<DashTile tone="info" circle>{initials(t.fullName)}</DashTile>}
                title={t.fullName}
                sub={parts.join(" · ")}
                end={t.delayedJobs > 0 ? <DashPill tone="warning">{t.delayedJobs} gecikmiş</DashPill> : undefined}
              />
            )
          })}
        </>
      )}
    </DashPanel>
  )
}
