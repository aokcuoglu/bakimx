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
        bg: "bg-warning/10 border-warning/20",
        icon: "text-warning",
        text: "text-foreground",
      }
    case "success":
      return {
        bg: "bg-success/10 border-success/20",
        icon: "text-success",
        text: "text-foreground",
      }
    default:
      return {
        bg: "bg-primary/10 border-primary/20",
        icon: "text-primary",
        text: "text-foreground",
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
      <div className="rounded-lg border border-success/20 bg-success/5 p-6 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-2" />
        <h3 className="text-base font-semibold text-foreground">Her Şey Yolunda</h3>
        <p className="text-sm text-muted-foreground mt-1">Şu anda dikkat gerektiren bir öneri yok.</p>
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
            className={`flex items-start gap-3 rounded-lg border ${styles.bg} px-4 py-3`}
          >
            <Icon className={`size-4 mt-0.5 shrink-0 ${styles.icon}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${styles.text}`}>{rec.message}</p>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-card/60 text-muted-foreground shrink-0">
              {categoryLabel(rec.category)}
            </span>
          </div>
        )
      })}
    </div>
  )
}