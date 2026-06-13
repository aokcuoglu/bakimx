import type { Recommendation } from "@/lib/analytics/queries"
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react"

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

function recStyles(type: Recommendation["type"]) {
  switch (type) {
    case "warning":
      return {
        bg: "bg-amber-50 border-amber-200",
        icon: "text-amber-600",
        text: "text-amber-800",
      }
    case "success":
      return {
        bg: "bg-emerald-50 border-emerald-200",
        icon: "text-emerald-600",
        text: "text-emerald-800",
      }
    default:
      return {
        bg: "bg-blue-50 border-blue-200",
        icon: "text-blue-600",
        text: "text-blue-800",
      }
  }
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    delayed: "Gecikme",
    stock: "Stok",
    revenue: "Gelir",
    approvals: "Onaylar",
    customers: "Müşteriler",
    health: "Sağlık",
  }
  return map[category] || category
}

export function RecommendationsList({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <CheckCircle2 className="size-8 text-emerald-600 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-emerald-800">Her Şey Yolunda</h3>
        <p className="text-sm text-emerald-700 mt-1">Şu anda dikkat gerektiren bir öneri yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => {
        const Icon = recIcon(rec.type)
        const styles = recStyles(rec.type)
        return (
          <div
            key={rec.id}
            className={`flex items-start gap-3 rounded-xl border ${styles.bg} px-4 py-3`}
          >
            <Icon className={`size-4 mt-0.5 shrink-0 ${styles.icon}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${styles.text}`}>{rec.message}</p>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/60 text-slate-500 shrink-0">
              {categoryLabel(rec.category)}
            </span>
          </div>
        )
      })}
    </div>
  )
}