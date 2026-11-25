import { SettingsTrail, SettingsTrailProvider } from "@/components/settings/settings-trail"

// AppShell'in Ayarlar dalıyla aynı sarmal ve yol satırı: yükleme ile yüklenmiş
// sayfada yol satırı ve başlık aynı yerde durur (#856).
export default function SettingsLoading() {
  return (
    <SettingsTrailProvider>
      <div role="status" aria-label="Ayarlar yükleniyor" className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pt-6 sm:pt-12">
        <div>
          <SettingsTrail />
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="space-y-5">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-2/3 animate-pulse rounded-md bg-muted" />
        </div>
        <span className="sr-only">Ayarlar yükleniyor</span>
      </div>
    </SettingsTrailProvider>
  )
}
