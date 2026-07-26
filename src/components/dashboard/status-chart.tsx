import type { StatusDistribution } from "@/lib/dashboard/queries"

export function StatusChart({ data }: { data: StatusDistribution[] }) {
  const total = data.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Bu Ay İş Durumları</h3>
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground/70">
          Bu ay iş emri bulunmuyor.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Bu Ay İş Durumları</h3>

      <div className="space-y-3">
        {data.map((s) => {
          const pct = Math.round((s.count / total) * 100)
          return (
            <div key={s.status}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs font-medium text-foreground">{s.label}</span>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {s.count} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
