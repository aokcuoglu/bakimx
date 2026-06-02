import type { StatusDistribution } from "@/lib/dashboard/queries"

export function StatusChart({ data }: { data: StatusDistribution[] }) {
  const total = data.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Bu Ay İş Durumları</h3>
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">
          Bu ay iş emri bulunmuyor.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Bu Ay İş Durumları</h3>

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
                  <span className="text-xs font-medium text-slate-700">{s.label}</span>
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  {s.count} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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
