import Link from "next/link"
import { Calendar } from "lucide-react"
import { AppointmentStatusBadge } from "@/components/app/appointment-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import type { TodayAppointmentRow } from "@/lib/dashboard/queries"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function TodayAppointments({ appointments }: { appointments: TodayAppointmentRow[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Bugünkü Randevular</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Calendar className="size-8 mb-2" />
            <p className="text-sm">Bugün için planlanmış randevu bulunmuyor</p>
          </div>
        ) : (
          appointments.map((a) => (
            <Link
              key={a.id}
              href={`/app/appointments/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="shrink-0 w-12 text-center">
                <span className="text-sm font-semibold text-slate-700">{formatTime(a.appointmentAt)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{a.customerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {a.plate && <PlateBadge plate={a.plate} />}
                  <span className="text-[11px] font-mono text-slate-400">{a.appointmentNo}</span>
                </div>
              </div>
              <AppointmentStatusBadge status={a.status} />
            </Link>
          ))
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-slate-100">
        <Link href="/app/appointments" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
          Tüm Randevular &rarr;
        </Link>
      </div>
    </div>
  )
}
