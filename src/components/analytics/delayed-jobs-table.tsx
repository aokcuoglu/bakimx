import type { DelayedJobRow } from "@/lib/analytics/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS } from "@/lib/constants"
import { Clock, User, Car } from "lucide-react"

function daysLabel(days: number): string {
  if (days === 0) return "Bugün"
  if (days === 1) return "1 gün"
  return `${days} gün`
}

function statusBadge(status: string): { label: string; color: string } | null {
  const s = ORDER_STATUS[status as keyof typeof ORDER_STATUS]
  if (!s) return null
  return { label: s.label, color: s.color }
}

export function DelayedJobsTable({ jobs }: { jobs: DelayedJobRow[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-success/10 text-success mb-3">
          <Clock className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Geciken İş Emri Yok</h3>
        <p className="text-sm text-muted-foreground mt-1">Tüm iş emirleri planlanan sürede.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Geciken İş Emirleri</h3>
          <span className="text-sm text-destructive font-medium">{jobs.length} geciken</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">İş Emri</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Gecikme</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Müşteri</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Araç</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Teknisyen</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const badge = statusBadge(job.status)
              return (
                <tr key={job.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${job.id}`} className="font-medium text-primary hover:text-primary/80">
                      {job.workOrderNo}
                    </Link>
                    {badge && (
                      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                      <Clock className="size-3.5" />
                      {daysLabel(job.daysDelayed)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <User className="size-3.5 text-muted-foreground/70" />
                      {job.customerName}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Car className="size-3.5 text-muted-foreground/70" />
                      {job.plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {job.technicianName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {job.total > 0 ? formatTRY(job.total) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}