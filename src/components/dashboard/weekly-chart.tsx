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
        <div className="flex h-48 items-end gap-2 px-5 pt-5 pb-4 sm:h-56 sm:gap-3">
          {data.map((d) => {
            const pct = (d.ordersCreated / maxVal) * 100
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[15px] font-semibold tabular-nums text-foreground">{d.ordersCreated}</span>
                <div className={surface.bar} style={{ height: `${Math.max(4, pct)}%` }} />
                <span className="text-[15px] text-muted-foreground">{d.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </DashPanel>
  )
}
