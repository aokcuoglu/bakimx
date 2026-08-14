import { BrandSpinner } from "@/components/shared/brand-spinner"

export function PublicPageLoading() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-muted p-6" role="status" aria-live="polite">
      <BrandSpinner size={52} />
      <p className="text-sm font-medium text-foreground">Bilgileriniz hazırlanıyor…</p>
      <p className="text-center text-xs text-muted-foreground">Bağlantınız kontrol ediliyor. Lütfen bu sayfayı kapatmayın.</p>
    </main>
  )
}
