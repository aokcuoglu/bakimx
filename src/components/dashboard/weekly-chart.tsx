import type { WeeklyOperation } from "@/lib/dashboard/queries"
import { DashEmpty, DashPanel, surface } from "@/components/dashboard/surface"

export function WeeklyChart({ data }: { data: WeeklyOperation[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.ordersCreated))
  const hasData = data.some((d) => d.ordersCreated > 0)

  return (
    <DashPanel title="Son 7 gün">
      {!hasData ? (
        <DashEmpty>Son 7 günde araç kabulü yok.</DashEmpty>
      ) : (
        <div className="flex h-40 items-end gap-2 px-4 pt-4 pb-3 sm:h-48 sm:gap-3">
          {data.map((d) => {
            const pct = (d.ordersCreated / maxVal) * 100
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-foreground">{d.ordersCreated}</span>
                <div className={surface.bar} style={{ height: `${Math.max(4, pct)}%` }} />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </DashPanel>
  )
}
