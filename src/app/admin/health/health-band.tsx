import Link from "next/link"
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getHealthSummary } from "@/lib/ops/health"
import { cn } from "@/lib/utils"

/** Compact health signal for the ops home. Reads the same summary as the
 *  /admin/health page. Best-effort: if the DB isn't reachable, render nothing. */
export async function HealthBand() {
  let summary
  try {
    summary = await getHealthSummary()
  } catch {
    return null
  }

  const items: string[] = []
  if (summary.cronStale) {
    items.push(
      summary.cronLastRunAt
        ? `Hatırlatma cron'u ${summary.cronAgeHours}s önce çalıştı (bayat)`
        : "Hatırlatma cron'u hiç çalışmadı",
    )
  } else if (summary.cronStatus === "error") {
    items.push("Son cron çalışması hata verdi")
  }
  if (summary.failedComms24h > 0) {
    items.push(`Son 24s'te ${summary.failedComms24h} başarısız iletişim`)
  }

  return (
    <Link
      href="/admin/health"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
        summary.ok
          ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
          : "bg-amber-50 border-amber-200 hover:border-amber-300",
      )}
    >
      <span className="flex items-center gap-2">
        {summary.ok ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <AlertTriangle className="size-4 text-amber-600" />
        )}
        <span className={cn("font-medium", summary.ok ? "text-emerald-800" : "text-amber-800")}>
          {summary.ok ? "Sistem sağlıklı" : items.join(" · ")}
        </span>
      </span>
      <Activity className="size-4 text-muted-foreground" />
    </Link>
  )
}
