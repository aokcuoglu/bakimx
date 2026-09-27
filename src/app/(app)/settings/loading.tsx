export default function SettingsLoading() {
  return (
    <div role="status" aria-label="Ayarlar yükleniyor" className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-16">
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-5">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-muted" />
      </div>
      <span className="sr-only">Ayarlar yükleniyor</span>
    </div>
  )
}
