import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { statusToneBadgeVariant, type StatusTone } from "@/lib/status-tone"
import { Badge } from "@/components/ui/badge"
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

function statusBadge(status: string): { label: string; tone: StatusTone } | null {
  const s = ORDER_STATUS[status as keyof typeof ORDER_STATUS]
  if (!s) return null
  return { label: s.label, tone: s.tone }
}

export function DelayedJobsTable({ jobs }: { jobs: DelayedJobRow[] }) {
  if (jobs.length === 0) {
    return (
      <div className="min-w-0 rounded-xl border border-border bg-card p-8 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-success/10 text-success-strong mb-3">
          <Clock className="size-6" />
        </div>
        <h3 className="text-sm font-medium text-foreground">Geciken Araç Kabul Yok</h3>
        <p className="text-sm text-muted-foreground mt-1">Tüm araç kabulleri planlanan sürede.</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Geciken Araç Kabulleri</h3>
          <span className="text-sm text-destructive-strong font-medium">{jobs.length} geciken</span>
        </div>
      </div>
      <div className="min-w-0">
        <Table aria-label="Geciken Araç Kabulleri">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4 text-xs text-muted-foreground">Araç Kabul</TableHead>
              <TableHead className="px-4 text-xs text-muted-foreground">Gecikme</TableHead>
              <TableHead className="px-4 text-xs text-muted-foreground hidden sm:table-cell">Müşteri</TableHead>
              <TableHead className="px-4 text-xs text-muted-foreground hidden md:table-cell">Araç</TableHead>
              <TableHead className="px-4 text-xs text-muted-foreground hidden lg:table-cell">Teknisyen</TableHead>
              <TableHead className="px-4 text-right text-xs text-muted-foreground">Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const badge = statusBadge(job.status)
              return (
                <TableRow key={job.id}>
                  <TableCell className="px-4 py-2">
                    <Link href={`/orders/${job.id}`} className="font-medium text-primary hover:underline">
                      {job.workOrderNo}
                    </Link>
                    {badge && (
                      <Badge variant={statusToneBadgeVariant(badge.tone)} className="ml-2 rounded-md px-1.5 text-[10px]">
                        {badge.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 text-destructive-strong font-medium">
                      <Clock className="size-3.5" />
                      {daysLabel(job.daysDelayed)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <User className="size-3.5 text-muted-foreground" />
                      {job.customerName}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Car className="size-3.5 text-muted-foreground" />
                      {job.plate}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2 hidden lg:table-cell text-muted-foreground">
                    {job.technicianName || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-medium text-foreground">
                    {job.total > 0 ? formatTRY(job.total) : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}