import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { prisma } from "@/lib/db"
import { cn } from "@/lib/utils"
import { deriveOverallStatus, OVERALL_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/status-page"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  path: "/status",
  title: "Sistem Durumu",
  description: "BakımX servislerinin güncel çalışma durumunu ve geçmiş olayları inceleyin.",
})

export const dynamic = "force-dynamic"

const HISTORY_LIMIT = 20

export default async function StatusPage() {
  const [incidents, activeIncidents] = await Promise.all([
    prisma.statusIncident.findMany({
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.statusIncident.findMany({
      where: { resolvedAt: null },
      select: { severity: true },
    }),
  ])

  const overallStatus = deriveOverallStatus(activeIncidents.map((incident) => incident.severity))

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Sistem Durumu</h1>
          <p className="text-sm text-muted-foreground mt-2">
            BakimX servislerinin güncel durumu ve geçmiş olaylar.
          </p>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            overallStatus === "operational"
              ? "bg-success/10 border-success/20"
              : overallStatus === "degraded"
                ? "bg-warning/10 border-warning/20"
                : "bg-destructive/10 border-destructive/20"
          )}
        >
          {overallStatus === "operational" ? (
            <CheckCircle2 className="size-5 text-success-strong shrink-0" />
          ) : (
            <AlertTriangle
              className={cn(
                "size-5 shrink-0",
                overallStatus === "degraded" ? "text-warning-strong" : "text-destructive-strong"
              )}
            />
          )}
          <span
            className={cn(
              "font-medium",
              overallStatus === "operational"
                ? "text-success-strong"
                : overallStatus === "degraded"
                  ? "text-warning-strong"
                  : "text-destructive-strong"
            )}
          >
            {OVERALL_STATUS_LABELS[overallStatus]}
          </span>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Geçmiş olaylar</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kayıtlı bir olay yok — tüm sistemler her zaman olduğu gibi çalışıyor.
            </p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border bg-card p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{incident.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      incident.resolvedAt
                        ? "bg-muted text-muted-foreground"
                        : incident.severity === "major_outage"
                          ? "bg-destructive/15 text-destructive-strong"
                          : "bg-warning/15 text-warning-strong"
                    )}
                  >
                    {incident.resolvedAt ? "Çözüldü" : SEVERITY_LABELS[incident.severity]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{incident.message}</p>
                {incident.resolutionNote && (
                  <p className="text-sm text-muted-foreground">{incident.resolutionNote}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {incident.createdAt.toLocaleString("tr-TR")}
                  {incident.resolvedAt && ` · Çözüldü: ${incident.resolvedAt.toLocaleString("tr-TR")}`}
                </p>
              </div>
            ))
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
