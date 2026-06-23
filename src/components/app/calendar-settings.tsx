"use client"

import Link from "next/link"
import { Calendar, CheckCircle2, XCircle, Info } from "lucide-react"

interface CalendarSettingsProps {
  settings: {
    provider: string
    googleConfigured: boolean
  }
}

export function CalendarSettings({ settings }: CalendarSettingsProps) {
  const providerLabel = settings.provider === "google" ? "Google Calendar" : "Mock (Varsayılan)"

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Takvim Sağlayıcısı</h3>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Aktif Sağlayıcı</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              <code className="px-1.5 py-0.5 rounded bg-border text-foreground text-xs font-mono">CALENDAR_PROVIDER={settings.provider}</code>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-foreground">
            {providerLabel}
          </span>
        </div>

        <div className="grid gap-3">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
            {settings.provider === "mock" ? (
              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="size-5 text-muted-foreground/50 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Mock Sağlayıcı</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Varsayılan sağlayıcı. Takvim etkinlikleri uygulama içinde gösterilir, harici senkronizasyon yapılmaz. API anahtarı gerekmez.
              </div>
              {settings.provider === "mock" && (
                <span className="inline-block mt-1 text-[10px] font-semibold text-foreground bg-success/10 px-1.5 py-0.5 rounded">AKTİF</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
            {settings.provider === "google" && settings.googleConfigured ? (
              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
            ) : settings.provider === "google" && !settings.googleConfigured ? (
              <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            ) : (
              <XCircle className="size-5 text-muted-foreground/50 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Google Calendar</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Randevu, teslimat ve bakım hatırlatmalarını Google Calendar ile senkronize eder.
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={settings.googleConfigured ? "text-success" : "text-muted-foreground/70"}>
                    {settings.googleConfigured ? "✓" : "○"}
                  </span>
                  <code className="font-mono text-muted-foreground">GOOGLE_CALENDAR_ID</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={settings.googleConfigured ? "text-success" : "text-muted-foreground/70"}>
                    {settings.googleConfigured ? "✓" : "○"}
                  </span>
                  <code className="font-mono text-muted-foreground">GOOGLE_CALENDAR_ACCESS_TOKEN</code>
                </div>
              </div>
              {settings.provider === "google" && settings.googleConfigured && (
                <span className="inline-block mt-1 text-[10px] font-semibold text-foreground bg-success/10 px-1.5 py-0.5 rounded">AKTİF</span>
              )}
              {settings.provider === "google" && !settings.googleConfigured && (
                <span className="inline-block mt-1 text-[10px] font-semibold text-foreground bg-destructive/10 px-1.5 py-0.5 rounded">KİMLİK BİLGİLERİ EKSİK</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Yapılandırma</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Takvim sağlayıcısını değiştirmek için <code className="px-1 py-0.5 rounded bg-muted text-foreground text-xs font-mono">.env.local</code> dosyasında
            aşağıdaki değişkenleri ayarlayın:
          </p>
          <pre className="bg-muted text-foreground p-3 rounded-lg text-xs overflow-x-auto">
{`# Takvim Sağlayıcısı — mock (varsayılan) veya google
CALENDAR_PROVIDER=mock

# Google Calendar (CALENDAR_PROVIDER=google iken gerekli)
# GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
# GOOGLE_CALENDAR_ACCESS_TOKEN=your-access-token
# GOOGLE_CALENDAR_API_URL=https://www.googleapis.com/calendar/v3`}
          </pre>
          <p className="text-xs text-muted-foreground/70">
            Uygulamayı yeniden başlattıktan sonra değişiklikler etkili olur. Google kimlik bilgileri olmadan <code className="text-muted-foreground">google</code> sağlayıcısı seçilirse sistem otomatik olarak mock sağlayıcıya döner.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Senkronizasyon Davranışı</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>Randevu oluşturulduğunda takvime otomatik senkronize edilir</li>
            <li>İş emri teslimat tarihi belirlendiğinde takvime eklenir</li>
            <li>Bakım hatırlatmaları due date ile takvime senkronize edilir</li>
            <li>Mock sağlayıcı ile tüm işlemler uygulama içinde gerçekleşir</li>
            <li>Senkronizasyon logları <Link href="/calendar" className="text-primary hover:text-primary underline">Takvim</Link> sayfasından takip edilebilir</li>
          </ul>
        </div>
      </div>
    </div>
  )
}