import type { WeeklyOperation } from "@/lib/dashboard/queries"

export function WeeklyChart({ data }: { data: WeeklyOperation[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.ordersCreated))
  const hasData = data.some((d) => d.ordersCreated > 0)

  if (!hasData) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">Son 7 Gün Operasyon</h3>
        <div className="flex h-36 items-center justify-center px-5 text-sm text-muted-foreground">
          Son 7 günde iş emri bulunmuyor.
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">Son 7 Gün Operasyon</h3>
      <div className="flex h-36 items-end gap-2 px-5 py-4 sm:h-44 sm:gap-3">
        {data.map((d) => {
          const pct = (d.ordersCreated / maxVal) * 100
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[11px] font-semibold text-muted-foreground">{d.ordersCreated}</span>
              <div
                className="w-full rounded-t-md bg-foreground/80 transition-all"
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              <span className="text-[11px] text-muted-foreground font-medium">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
