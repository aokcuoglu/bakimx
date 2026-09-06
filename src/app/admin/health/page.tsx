import { Ban, CheckCircle2, MapPinned, ShieldCheck, XCircle, AlertTriangle } from "lucide-react"
import { requireAdminCapability } from "@/lib/admin"
import { getHealthDetail } from "@/lib/ops/health"
import { getRapidApiUsage } from "@/lib/rapidapi-quota"
import { getGoogleMapsUsageSnapshot } from "@/lib/sales/google-maps-usage.server"
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
  const [detail, usage, googleMapsUsage] = await Promise.all([
    getHealthDetail(),
    getRapidApiUsage(),
    getGoogleMapsUsageSnapshot(),
  ])
  const { summary } = detail

  const usageTone =
    usage.pct >= 90 ? "rose" : usage.pct >= 70 ? "amber" : "emerald"
  const usageBar =
    usageTone === "rose" ? "bg-destructive/100" : usageTone === "amber" ? "bg-warning/100" : "bg-success/100"

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
          summary.ok ? "bg-success/10 border-success/20" : "bg-warning/10 border-warning/20",
        )}
      >
        {summary.ok ? (
          <CheckCircle2 className="size-5 text-success-strong" />
        ) : (
          <AlertTriangle className="size-5 text-warning-strong" />
        )}
        <span className={cn("font-medium", summary.ok ? "text-success-strong" : "text-warning-strong")}>
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
                summary.cronStale || summary.cronStatus === "error" ? "text-warning-strong" : "text-success-strong",
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
                  <CheckCircle2 className="size-4 text-success-strong mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="size-4 text-destructive-strong mt-0.5 shrink-0" />
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

      <Section title="RapidAPI Kotası (bu ay · şase + parça kataloğu ortak)">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {usage.total.toLocaleString("tr-TR")}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}/ {usage.cap.toLocaleString("tr-TR")}
            </span>
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              usageTone === "rose" ? "text-destructive-strong" : usageTone === "amber" ? "text-warning-strong" : "text-success-strong",
            )}
          >
            %{usage.pct.toFixed(1)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", usageBar)} style={{ width: `${Math.min(usage.pct, 100)}%` }} />
        </div>

        <div className="space-y-1 pt-1">
          {usage.breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="text-foreground tabular-nums">
                {b.billed.toLocaleString("tr-TR")} çağrı
                {b.served > 0 && (
                  <span className="text-muted-foreground"> · {b.served.toLocaleString("tr-TR")} cache</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0 text-warning-strong mt-0.5" />
          <span>
            Yalnızca bu uygulamanın kaydettiği çağrıları sayar. Hatalı çağrılar faturalanır ama cache&apos;lenmez ve{" "}
            <code className="font-mono">migrate reset</code> bu satırları siler — gerçek sayı için RapidAPI panosuna
            bakın. Geliştirme sırasındaki manuel denemeler burada görünmez.
          </span>
        </p>
      </Section>

      <Section title={`Google Maps maliyet koruması (${googleMapsUsage.period} · UTC)`}>
        <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/10 p-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-strong" />
          <div>
            <p className="text-sm font-semibold text-success-strong">Ücretli kullanıma otomatik geçiş kapalı</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground-strong">
              Her Google işlemi önce ortak sayaçtan hak ayırır. Aylık uygulama limiti dolarsa veya sayaç
              doğrulanamazsa istek Google&apos;a gönderilmez. Google Cloud günlük kotaları ikinci sert katmandır.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {googleMapsUsage.rows.map((row) => {
            const pct = row.limit === 0 ? 100 : row.used / row.limit * 100
            const tone = !row.allowed || row.blocked > 0 ? "danger" : pct >= 75 ? "warning" : "success"
            const bar = tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success"
            const text = tone === "danger"
              ? "text-destructive-strong"
              : tone === "warning"
                ? "text-warning-strong"
                : "text-success-strong"
            const lastEventAt = row.lastBlockedAt && (!row.lastReservedAt || row.lastBlockedAt > row.lastReservedAt)
              ? row.lastBlockedAt
              : row.lastReservedAt

            return (
              <div key={row.sku} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPinned className={cn("mt-0.5 size-4 shrink-0", text)} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Google ücretsiz: {row.freeMonthlyCap.toLocaleString("tr-TR")}/ay
                      </p>
                    </div>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums", text)}>%{pct.toFixed(1)}</span>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {row.used.toLocaleString("tr-TR")}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}/ {row.limit.toLocaleString("tr-TR")} rezerve
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {row.remaining.toLocaleString("tr-TR")} kaldı
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground-strong">
                    Cloud sert kota
                    <span className="mt-0.5 block font-semibold tabular-nums text-foreground">
                      {row.cloudDailyLimit.toLocaleString("tr-TR")}/gün
                    </span>
                  </div>
                  <div className="rounded-md bg-muted p-2 text-muted-foreground-strong">
                    Engellenen
                    <span
                      className={cn(
                        "mt-0.5 flex items-center gap-1 font-semibold tabular-nums",
                        row.blocked > 0 ? "text-destructive-strong" : "text-foreground",
                      )}
                    >
                      {row.blocked > 0 && <Ban className="size-3" />}
                      {row.blocked.toLocaleString("tr-TR")}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Son olay: {lastEventAt ? lastEventAt.toLocaleString("tr-TR") : "Henüz çağrı yok"}
                </p>
              </div>
            )
          })}
        </div>

        <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-strong" />
          <span>
            Bunlar Google&apos;a gitmeden önce ayrılan uygulama haklarıdır; başarısız Google çağrıları da güvenli tarafta
            kalmak için sayılır. Session token bir tüketim birimi değildir. Kesin faturalama verisi Google Cloud
            Billing&apos;dedir ve gecikmeli olabilir; burada gösterilen sayaç ücret sınırını açamaz.
          </span>
        </p>
      </Section>

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
