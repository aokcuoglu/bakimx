import type { Recommendation } from "@/lib/analytics/queries"
import { AlertTriangle, Info, CheckCircle2, AlertTriangle as AlertIcon } from "lucide-react"
import Link from "next/link"

function recIcon(type: Recommendation["type"]) {
  switch (type) {
    case "warning":
      return AlertTriangle
    case "success":
      return CheckCircle2
    default:
      return Info
  }
}

function iconColor(type: Recommendation["type"]): string {
  switch (type) {
    case "warning":
      return "text-amber-500"
    case "success":
      return "text-emerald-500"
    default:
      return "text-blue-500"
  }
}

export function OperationalAlertsWidget({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <Link
        href="/app/analytics"
        className="block rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 hover:border-emerald-300 transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-emerald-800">Operasyon Uyarıları</h3>
        </div>
        <p className="text-xs text-emerald-600">Tüm işlemler yolunda.</p>
      </Link>
    )
  }

  return (
    <Link
      href="/app/analytics"
      className="block rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertIcon className="size-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">Operasyon Uyarıları</h3>
        <span className="ml-auto text-xs text-slate-500">{recommendations.length} öneri</span>
      </div>
      <div className="space-y-2">
        {recommendations.slice(0, 3).map((rec) => {
          const Icon = recIcon(rec.type)
          return (
            <div key={rec.id} className="flex items-start gap-2">
              <Icon className={`size-3.5 mt-0.5 shrink-0 ${iconColor(rec.type)}`} />
              <p className="text-xs text-slate-700 line-clamp-2">{rec.message}</p>
            </div>
          )
        })}
        {recommendations.length > 3 && (
          <p className="text-xs text-blue-600 font-medium">+{recommendations.length - 3} daha</p>
        )}
      </div>
    </Link>
  )
}