import type { TechnicianRanking } from "@/lib/analytics/queries"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { HardHat, TrendingUp, Users } from "lucide-react"

export function TechnicianAnalyticsSection({ ranking }: { ranking: TechnicianRanking }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="size-4 text-success" />
            <h3 className="text-base font-semibold text-foreground">En Hızlı Teknisyenler</h3>
          </div>
          {ranking.fastest.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Tamamlanmış iş emri olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranking.fastest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{tech.fullName}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo?.label || tech.role} · {tech.completedJobs} tamamlanan</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {tech.avgCompletionDays !== null ? `${tech.avgCompletionDays} gün` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">ort. tamamlama</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">En Yoğun Teknisyenler</h3>
          </div>
          {ranking.busiest.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aktif iş emri olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranking.busiest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{tech.fullName}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo?.label || tech.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{tech.activeJobs}</p>
                      <p className="text-xs text-muted-foreground">aktif iş</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
          <HardHat className="size-4 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">Teknisyen Performans Özeti</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Teknisyen</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Rol</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Aktif</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Tamamlanan</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Ort. Süre</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {[...ranking.fastest, ...ranking.busiest]
                .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
                .map((tech) => {
                  const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                  return (
                    <tr key={tech.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-2.5 font-medium text-foreground">{tech.fullName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{roleInfo?.label || tech.role}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {tech.activeJobs}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-success/10 text-success text-xs font-medium">
                          {tech.completedJobs}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-foreground">
                        {tech.avgCompletionDays !== null ? `${tech.avgCompletionDays} gün` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">{tech.totalAssigned}</td>
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