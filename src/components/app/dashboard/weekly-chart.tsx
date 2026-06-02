import type { WeeklyOperation } from "@/lib/dashboard/queries"

export function WeeklyChart({ data }: { data: WeeklyOperation[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.ordersCreated))
  const hasData = data.some((d) => d.ordersCreated > 0)

  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Son 7 Gün Operasyon</h3>
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">
          Son 7 günde iş emri bulunmuyor.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Son 7 Gün Operasyon</h3>
      <div className="flex items-end gap-2 sm:gap-3 h-32 sm:h-40">
        {data.map((d) => {
          const pct = (d.ordersCreated / maxVal) * 100
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[11px] font-semibold text-slate-600">{d.ordersCreated}</span>
              <div
                className="w-full rounded-t-md bg-blue-500 transition-all"
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              <span className="text-[11px] text-slate-400 font-medium">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
