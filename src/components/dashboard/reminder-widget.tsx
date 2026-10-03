"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BellRing, Calendar, Gauge, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/reminders/reminder-status-badge"
import { PlateBadge } from "@/components/shared/plate-badge"
import { formatDate } from "@/lib/utils-client"
import type { ReminderRow } from "@/lib/reminders/queries"

type Props = {
  dueSoon: ReminderRow[]
  overdue: ReminderRow[]
}

function customerName(c: ReminderRow["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}

export function ReminderWidget({ dueSoon, overdue }: Props) {
  const hasItems = dueSoon.length > 0 || overdue.length > 0
  const totalCount = overdue.length + dueSoon.length

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-muted-foreground" />
          Bakım Hatırlatmaları
          {totalCount > 0 ? (
            <span className="text-xs text-muted-foreground font-normal">({totalCount})</span>
          ) : null}
        </CardTitle>
        <div className="flex items-center gap-2">
          {overdue.length > 0 ? (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-xs font-medium bg-destructive/10 text-destructive-strong border border-destructive/20">
              {overdue.length} Geciken
            </span>
          ) : null}
          <Link
            href="/reminders/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
          >
            <Plus className="size-3.5" />
            Yeni
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasItems ? (
          <div className="space-y-2 text-muted-foreground">
            <p className="text-sm">Yaklaşan veya geciken bakım hatırlatması yok.</p>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/reminders/new"><Plus className="size-3.5" />Yeni hatırlatma oluştur</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border -mx-3">
            {[...overdue, ...dueSoon].slice(0, 10).map((r) => (
              <Link
                key={r.id}
                href={`/reminders/${r.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlateBadge plate={r.vehicle.plate} />
                    <ReminderTypeBadge type={r.type} />
                    <ReminderStatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {customerName(r.customer)} — {r.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {r.dueDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(r.dueDate)}
                      </span>
                    ) : null}
                    {r.dueMileage ? (
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="size-3" />
                        {r.dueMileage.toLocaleString("tr-TR")} km
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {hasItems ? (
          <div className="mt-2 pt-2 border-t border-border text-center">
            <Link
              href="/reminders"
              className="text-xs text-primary hover:underline font-medium"
            >
              Tüm hatırlatmaları görüntüle
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
