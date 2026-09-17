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
      return "text-warning-strong"
    case "success":
      return "text-success-strong"
    default:
      return "text-primary"
  }
}

export function OperationalAlertsWidget({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <Link
        href="/analytics"
        className="block rounded-lg border border-border bg-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <CheckCircle2 className="size-4 text-success-strong" />
          <h3 className="text-sm font-semibold text-foreground">Operasyon Uyarıları</h3>
        </div>
        <p className="px-4 py-3 text-sm text-muted-foreground">Tüm işlemler yolunda.</p>
      </Link>
    )
  }

  return (
    <Link
      href="/analytics"
      className="block rounded-lg border border-border bg-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <AlertIcon className="size-4 text-warning-strong" />
        <h3 className="text-sm font-semibold text-foreground">Operasyon Uyarıları</h3>
        <span className="ml-auto text-xs text-muted-foreground">{recommendations.length} öneri</span>
      </div>
      <div className="space-y-2 px-4 py-3">
        {recommendations.slice(0, 3).map((rec) => {
          const Icon = recIcon(rec.type)
          return (
            <div key={rec.id} className="flex items-start gap-2">
              <Icon className={`size-3.5 mt-0.5 shrink-0 ${iconColor(rec.type)}`} />
              <p className="text-xs text-foreground line-clamp-2">{rec.message}</p>
            </div>
          )
        })}
        {recommendations.length > 3 && (
          <p className="text-xs text-foreground font-medium">+{recommendations.length - 3} daha</p>
        )}
      </div>
    </Link>
  )
}
