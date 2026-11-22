import type { Recommendation } from "@/lib/analytics/queries"
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { DashPanel, DashRow, DashTile, type Tone } from "@/components/dashboard/surface"

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

function recTone(type: Recommendation["type"]): Tone {
  switch (type) {
    case "warning":
      return "warning"
    case "success":
      return "success"
    default:
      return "info"
  }
}

export function OperationalAlertsWidget({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <DashPanel
      title="Operasyon önerileri"
      meta={recommendations.length > 0 ? recommendations.length : undefined}
      action={{ href: "/analytics", label: "Analiz" }}
    >
      {recommendations.length === 0 ? (
        <DashRow
          href="/analytics"
          start={<DashTile tone="success" circle><CheckCircle2 /></DashTile>}
          title="Tüm işlemler yolunda"
        />
      ) : (
        recommendations.slice(0, 3).map((rec) => {
          const Icon = recIcon(rec.type)
          return (
            <DashRow
              key={rec.id}
              href="/analytics"
              start={<DashTile tone={recTone(rec.type)}><Icon /></DashTile>}
              title={rec.message}
              wrap
            />
          )
        })
      )}
    </DashPanel>
  )
}
