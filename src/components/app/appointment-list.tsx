"use client"

import Link from "next/link"
import { AppointmentStatusBadge } from "@/components/app/appointment-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
import { REMINDER_STATUS } from "@/lib/constants"
import { customerDisplayName } from "@/lib/format"
import { formatDateTime } from "@/lib/utils-client"
import { cn } from "@/lib/utils"

type AppointmentRow = {
  id: string
  appointmentNo: string
  status: string
  appointmentAt: string
  estimatedDurationMinutes: number | null
  title: string | null
  customerRequest: string | null
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
  vehicle: {
    id: string
    plate: string
    brand: string
    model: string
  } | null
  convertedServiceOrder: { id: string; workOrderNo: string | null } | null
  reminderStatus: string
}

type StatusCounts = {
  today: number
  upcoming: number
  confirmed: number
  arrived: number
  no_show: number
  cancelled: number
}

function ReminderStatusBadge({ status }: { status: string }) {
  const info = REMINDER_STATUS[status as keyof typeof REMINDER_STATUS]
  const label = info?.label || status
  const color = info?.color || "bg-muted text-muted-foreground/70 border-border"
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap h-5 px-2 text-[11px]", color)}>
      {label}
    </span>
  )
}

export function AppointmentList({
  appointments,
  counts,
  activeStatus,
  activeDate,
  search,
}: {
  appointments: AppointmentRow[]
  counts: StatusCounts
  activeStatus: string
  activeDate: string
  search: string
}) {
  const kpiConfig = [
    { key: "today" as const, label: "Bugün", count: counts.today, filter: "date" as const, value: "today" },
    { key: "upcoming" as const, label: "Yaklaşan", count: counts.upcoming, filter: "date" as const, value: "upcoming" },
    { key: "confirmed" as const, label: "Onaylı", count: counts.confirmed, filter: "status" as const, value: "confirmed" },
    { key: "arrived" as const, label: "Geldi", count: counts.arrived, filter: "status" as const, value: "arrived" },
    { key: "no_show" as const, label: "Gelmedi", count: counts.no_show, filter: "status" as const, value: "no_show" },
    { key: "cancelled" as const, label: "İptal", count: counts.cancelled, filter: "status" as const, value: "cancelled" },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiConfig.map((cfg) => {
          const isActive = cfg.filter === "date" ? activeDate === cfg.value : activeStatus === cfg.value
          const href = isActive
            ? `/appointments${search ? `?q=${search}` : ""}`
            : cfg.filter === "date"
            ? `/appointments?date=${cfg.value}${search ? `&q=${search}` : ""}`
            : `/appointments?status=${cfg.value}${search ? `&q=${search}` : ""}`
          return (
            <Link
              key={cfg.key}
              href={href}
              className={cn(
                "rounded-lg border bg-card p-3 sm:p-4 transition-all hover:shadow-sm touch-manipulation",
                isActive ? "ring-2 ring-primary border-primary" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{cfg.label}</span>
                <span className="h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold bg-muted text-muted-foreground border-border">
                  {cfg.count}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">{cfg.count}</p>
            </Link>
          )
        })}
      </div>

      <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Randevu No</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih/Saat</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Plaka / Araç</th>
                <th className="px-4 py-3 text-left font-semibold">Talep</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-left font-semibold">Hatırlatma</th>
                <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-muted">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/60 transition-colors group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/appointments/${a.id}`}
                      className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {a.appointmentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(a.appointmentAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${a.customer.id}`}
                      className="text-foreground font-medium hover:text-primary transition-colors"
                    >
                      {customerDisplayName(a.customer)}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {a.vehicle ? (
                      <div className="flex flex-col gap-1.5">
                        <Link href={`/vehicles/${a.vehicle.id}`}>
                          <PlateBadge plate={a.vehicle.plate} />
                        </Link>
                        <span className="text-xs text-muted-foreground">{a.vehicle.brand} {a.vehicle.model}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/70 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {a.customerRequest || <span className="text-muted-foreground/70">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AppointmentStatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ReminderStatusBadge status={a.reminderStatus} />
                  </td>
                  <td className="px-4 py-3 sticky right-0 bg-card group-hover:bg-muted/60">
                    <div className="flex items-center justify-end">
                      <ActionsMenu
                        viewHref={`/appointments/${a.id}`}
                        editHref={`/appointments/${a.id}?edit=1`}
                        workOrderHref={a.vehicle ? `/orders/new?vehicleId=${a.vehicle.id}&customerId=${a.customer.id}` : `/orders/new?customerId=${a.customer.id}`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden space-y-2.5">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/appointments/${a.id}`}
                    className="font-mono text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    {a.appointmentNo}
                  </Link>
                  {a.vehicle && (
                    <Link href={`/vehicles/${a.vehicle.id}`}>
                      <PlateBadge plate={a.vehicle.plate} />
                    </Link>
                  )}
                </div>
                <Link
                  href={`/customers/${a.customer.id}`}
                  className="mt-1.5 text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
                >
                  {customerDisplayName(a.customer)}
                </Link>
                {a.vehicle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {a.vehicle.brand} {a.vehicle.model}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(a.appointmentAt)}
                </p>
                {a.customerRequest && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.customerRequest}</p>
                )}
              </div>
              <MobileActionsMenu
                viewHref={`/appointments/${a.id}`}
                editHref={`/appointments/${a.id}?edit=1`}
                workOrderHref={a.vehicle ? `/orders/new?vehicleId=${a.vehicle.id}&customerId=${a.customer.id}` : `/orders/new?customerId=${a.customer.id}`}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <AppointmentStatusBadge status={a.status} />
              <ReminderStatusBadge status={a.reminderStatus} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}