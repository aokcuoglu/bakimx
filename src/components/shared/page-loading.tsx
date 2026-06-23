import { BrandSpinner } from "@/components/shared/brand-spinner"

/**
 * Route segment yükleme durumu. Kalıcı kabuk (sidebar/header/alt-nav) artık
 * layout'ta mount edildiği için burada SADECE içerik alanının spinner'ı render
 * edilir; kabuk gezinti boyunca yerinde kalır. Tüm `app/**\/loading.tsx`
 * dosyaları bunu kullanır.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <BrandSpinner size={56} label="Yükleniyor…" />
    </div>
  )
}
