"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { formatDate } from "@/lib/utils-client"
import type { ReminderRow } from "@/lib/reminders/queries"
import { DashPanel, DashPill, DashPlate, DashRow, surface } from "@/components/dashboard/surface"

type Props = {
  dueSoon: ReminderRow[]
  overdue: ReminderRow[]
}

function customerName(c: ReminderRow["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}

function dueText(r: ReminderRow): string | undefined {
  const parts: string[] = []
  if (r.dueDate) parts.push(formatDate(r.dueDate))
  if (r.dueMileage) parts.push(`${r.dueMileage.toLocaleString("tr-TR")} km`)
  return parts.length ? parts.join(" · ") : undefined
}

export function ReminderWidget({ dueSoon, overdue }: Props) {
  const overdueIds = new Set(overdue.map((r) => r.id))
  const rows = [...overdue, ...dueSoon].slice(0, 10)

  return (
    <DashPanel
      title="Bakım hatırlatmaları"
      meta={rows.length > 0 ? overdue.length + dueSoon.length : undefined}
      action={{ href: "/reminders", label: "Tümünü gör" }}
    >
      {rows.length === 0 ? (
        <p className={surface.empty}>Yaklaşan veya geciken bakım hatırlatması yok.</p>
      ) : (
        rows.map((r) => (
          <DashRow
            key={r.id}
            href={`/reminders/${r.id}`}
            stack
            start={<DashPlate plate={r.vehicle.plate} />}
            title={`${customerName(r.customer)} · ${r.title}`}
            sub={dueText(r)}
            end={overdueIds.has(r.id) ? <DashPill tone="destructive">Gecikti</DashPill> : <DashPill tone="info">Yaklaşıyor</DashPill>}
            chevron={false}
          />
        ))
      )}
      <div className={surface.cardFoot}>
        <span />
        <Button variant="ghost" size="sm" className="rounded-full text-primary-strong" asChild>
          <Link href="/reminders/new"><Plus className="size-4" />Yeni hatırlatma</Link>
        </Button>
      </div>
    </DashPanel>
  )
}
