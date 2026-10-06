import type { StatusDistribution } from "@/lib/dashboard/queries"

export function StatusChart({ data }: { data: StatusDistribution[] }) {
  const total = data.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Bu Ay İş Durumları</h3>
        <div className="flex min-h-16 items-center px-4 py-4 text-sm text-muted-foreground">
          Bu ay iş emri bulunmuyor.
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Bu Ay İş Durumları</h3>

      <div className="space-y-3 px-4 py-3">
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
