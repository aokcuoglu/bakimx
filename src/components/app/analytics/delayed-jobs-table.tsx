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
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
          <Clock className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Geciken İş Emri Yok</h3>
        <p className="text-sm text-slate-500 mt-1">Tüm iş emirleri planlanan sürede.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Geciken İş Emirleri</h3>
          <span className="text-sm text-red-600 font-medium">{jobs.length} geciken</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">İş Emri</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Gecikme</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 hidden sm:table-cell">Müşteri</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 hidden md:table-cell">Araç</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500 hidden lg:table-cell">Teknisyen</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-500">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const badge = statusBadge(job.status)
              return (
                <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/app/orders/${job.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {job.workOrderNo}
                    </Link>
                    {badge && (
                      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <Clock className="size-3.5" />
                      {daysLabel(job.daysDelayed)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <User className="size-3.5 text-slate-400" />
                      {job.customerName}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Car className="size-3.5 text-slate-400" />
                      {job.plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                    {job.technicianName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
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