"use client"

import Link from "next/link"
import { BellRing, Calendar, Gauge, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/app/reminder-status-badge"
import { PlateBadge } from "@/components/app/plate-badge"
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-slate-500" />
          Bakım Hatırlatmaları
          {totalCount > 0 ? (
            <span className="text-xs text-slate-500 font-normal">({totalCount})</span>
          ) : null}
        </CardTitle>
        <div className="flex items-center gap-2">
          {overdue.length > 0 ? (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
              {overdue.length} Geciken
            </span>
          ) : null}
          <Link
            href="/app/reminders/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="size-3.5" />
            Yeni
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasItems ? (
          <div className="text-center py-8 text-slate-500">
            <BellRing className="size-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Yaklaşan veya geciken bakım hatırlatması yok.</p>
            <Link
              href="/app/reminders/new"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="size-3.5" />
              Yeni hatırlatma oluştur
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
            {[...overdue, ...dueSoon].slice(0, 10).map((r) => (
              <Link
                key={r.id}
                href={`/app/reminders/${r.id}`}
                className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlateBadge plate={r.vehicle.plate} />
                    <ReminderTypeBadge type={r.type} />
                    <ReminderStatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {customerName(r.customer)} — {r.title}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
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
          <div className="mt-2 pt-2 border-t border-slate-100 text-center">
            <Link
              href="/app/reminders"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Tüm hatırlatmaları görüntüle
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
