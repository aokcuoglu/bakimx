import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
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
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Her Şey Yolunda</AlertTitle>
        <AlertDescription>Şu anda dikkat gerektiren bir öneri yok.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => {
        const Icon = recIcon(rec.type)
        return (
          <Alert key={rec.id} variant={rec.type === "warning" ? "warning" : rec.type === "success" ? "success" : "info"}>
            <Icon />
            <AlertTitle className="wrap-anywhere">{rec.message}</AlertTitle>
            <AlertDescription className="text-xs">{categoryLabel(rec.category)}</AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}