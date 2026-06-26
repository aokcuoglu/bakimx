import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { requireAdminCapability } from "@/lib/admin"
import { getHealthDetail } from "@/lib/ops/health"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default async function AdminHealthPage() {
  await requireAdminCapability("viewHealth")
  const detail = await getHealthDetail()
  const { summary } = detail

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Sistem Sağlığı</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cron, iletişim ve yapılandırma durumu.</p>
      </div>

      {/* Header status */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
          summary.ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200",
        )}
      >
        {summary.ok ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <AlertTriangle className="size-5 text-amber-600" />
        )}
        <span className={cn("font-medium", summary.ok ? "text-emerald-800" : "text-amber-800")}>
          {summary.ok ? "Tüm sistemler sağlıklı" : "Dikkat gerektiren durumlar var"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Hatırlatma Cron'u">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Son çalışma</span>
            <span className="font-medium text-foreground">
              {summary.cronLastRunAt ? summary.cronLastRunAt.toLocaleString("tr-TR") : "Hiç"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Durum</span>
            <span
              className={cn(
                "font-medium",
                summary.cronStale || summary.cronStatus === "error" ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {summary.cronStale ? "Bayat" : summary.cronStatus === "error" ? "Hata" : "Güncel"}
            </span>
          </div>
          {detail.cronRuns.length > 0 && (
            <div className="pt-1 space-y-1">
              {detail.cronRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{r.startedAt.toLocaleString("tr-TR")}</span>
                  <span>
                    {r.sent} gönderildi · {r.failed} başarısız · {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Yapılandırma">
          <div className="space-y-2">
            {detail.configChecks.map((c) => (
              <div key={c.label} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="size-4 text-rose-600 mt-0.5 shrink-0" />
                )}
                <span>
                  <span className="text-foreground">{c.label}</span>
                  {!c.ok && <span className="block text-xs text-muted-foreground">{c.hint}</span>}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title={`Başarısız İletişim (son 24s · ${detail.failedComms.length})`}>
        {detail.failedComms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Başarısız gönderim yok.</p>
        ) : (
          <div className="space-y-1.5">
            {detail.failedComms.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {c.type} · {c.templateKey ?? "—"} · <span className="font-mono text-xs">{c.recipient}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {c.errorMessage ?? "—"} · {c.sentAt.toLocaleDateString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {detail.failedReminders.length > 0 && (
        <Section title="Başarısız Hatırlatma İşleri">
          <div className="space-y-1.5">
            {detail.failedReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{r.jobType}</span>
                <span className="text-xs text-muted-foreground">
                  {r.failedCount} başarısız · {r.executedAt.toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {detail.failedSyncs.length > 0 && (
        <Section title="Başarısız Takvim Senkronları">
          <div className="space-y-1.5">
            {detail.failedSyncs.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{s.provider}</span>
                <span className="text-xs text-muted-foreground">
                  {s.errorMessage ?? "—"} · {s.syncedAt.toLocaleDateString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
