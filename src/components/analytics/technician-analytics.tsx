import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import type { TechnicianRanking } from "@/lib/analytics/queries"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { HardHat, TrendingUp, Users } from "lucide-react"

export function TechnicianAnalyticsSection({ ranking }: { ranking: TechnicianRanking }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingUp className="size-4 text-success-strong" />
            <h3 className="text-sm font-medium text-foreground">En Hızlı Teknisyenler</h3>
          </div>
          {ranking.fastest.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Tamamlanmış araç kabulü olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranking.fastest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="shrink-0 size-7 rounded-full bg-success/10 text-success-strong flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0 wrap-anywhere">
                        <p className="text-sm font-medium text-foreground">{tech.fullName}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo?.label || tech.role} · {tech.completedJobs} tamamlanan</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
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

        <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">En Yoğun Teknisyenler</h3>
          </div>
          {ranking.busiest.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aktif araç kabulü olan teknisyen bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranking.busiest.map((tech, i) => {
                const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                return (
                  <div key={tech.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="shrink-0 size-7 rounded-full bg-primary/10 text-primary-strong flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0 wrap-anywhere">
                        <p className="text-sm font-medium text-foreground">{tech.fullName}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo?.label || tech.role}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
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

      <div className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <HardHat className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Teknisyen Performans Özeti</h3>
        </div>
        <div className="min-w-0">
          <Table aria-label="Teknisyen Performans Özeti">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 text-xs text-muted-foreground">Teknisyen</TableHead>
                <TableHead className="px-4 text-xs text-muted-foreground">Rol</TableHead>
                <TableHead className="px-4 text-right text-xs text-muted-foreground">Aktif</TableHead>
                <TableHead className="px-4 text-right text-xs text-muted-foreground">Tamamlanan</TableHead>
                <TableHead className="px-4 text-right text-xs text-muted-foreground">Ort. Süre</TableHead>
                <TableHead className="px-4 text-right text-xs text-muted-foreground">Toplam</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...ranking.fastest, ...ranking.busiest]
                .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
                .map((tech) => {
                  const roleInfo = TECHNICIAN_ROLES[tech.role as keyof typeof TECHNICIAN_ROLES]
                  return (
                    <TableRow key={tech.id}>
                      <TableCell className="px-4 py-2 font-medium text-foreground">{tech.fullName}</TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">{roleInfo?.label || tech.role}</TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary-strong text-xs font-medium">
                          {tech.activeJobs}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-success/10 text-success-strong text-xs font-medium">
                          {tech.completedJobs}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums text-foreground">
                        {tech.avgCompletionDays !== null ? `${tech.avgCompletionDays} gün` : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums text-muted-foreground">{tech.totalAssigned}</TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}