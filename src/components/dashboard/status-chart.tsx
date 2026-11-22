import type { StatusDistribution } from "@/lib/dashboard/queries"
import { DashEmpty, DashPanel } from "@/components/dashboard/surface"

export function StatusChart({ data }: { data: StatusDistribution[] }) {
  const total = data.reduce((sum, s) => sum + s.count, 0)

  return (
    <DashPanel title="Bu ay iş durumları">
      {total === 0 ? (
        <DashEmpty>Bu ay araç kabulü yok.</DashEmpty>
      ) : (
        <div className="space-y-4 px-5 py-5">
          {data.map((s) => {
            const pct = Math.round((s.count / total) * 100)
            return (
              <div key={s.status}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[17px] font-medium text-foreground">{s.label}</span>
                  </div>
                  <span className="text-[15px] tabular-nums text-muted-foreground">
                    {s.count} · %{pct}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashPanel>
  )
}
