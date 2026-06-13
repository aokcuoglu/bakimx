import type { TechnicianRanking } from "@/lib/analytics/queries"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { HardHat, TrendingUp, Users } from "lucide-react"

export function TechnicianAnalyticsSection({ ranking }: { ranking: TechnicianRanking }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">En Hızlı Teknisyenler</h3>
          </div>
          {ranking.fastest.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Tamamlanmış iş emri olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ranking.fastest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tech.fullName}</p>
                        <p className="text-xs text-slate-500">{roleInfo?.label || tech.role} · {tech.completedJobs} tamamlanan</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {tech.avgCompletionDays !== null ? `${tech.avgCompletionDays} gün` : "—"}
                      </p>
                      <p className="text-xs text-slate-500">ort. tamamlama</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Users className="size-4 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">En Yoğun Teknisyenler</h3>
          </div>
          {ranking.busiest.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Aktif iş emri olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ranking.busiest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tech.fullName}</p>
                        <p className="text-xs text-slate-500">{roleInfo?.label || tech.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{tech.activeJobs}</p>
                      <p className="text-xs text-slate-500">aktif iş</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <HardHat className="size-4 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-900">Teknisyen Performans Özeti</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Teknisyen</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500">Rol</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-500">Aktif</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-500">Tamamlanan</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-500">Ort. Süre</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-500">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {[...ranking.fastest, ...ranking.busiest]
                .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
                .map((tech) => {
                  const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                  return (
                    <tr key={tech.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{tech.fullName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{roleInfo?.label || tech.role}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {tech.activeJobs}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                          {tech.completedJobs}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-700">
                        {tech.avgCompletionDays !== null ? `${tech.avgCompletionDays} gün` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-600">{tech.totalAssigned}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}