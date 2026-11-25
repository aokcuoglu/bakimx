import type { ReactNode } from "react"
import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FEATURE_CATALOG, addonContactMessage, lockedFeatureLabels } from "@/lib/feature-catalog"
import type { AddonFeature } from "@/lib/plan"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"

/**
 * Kilitli ek özelliğin satır içi notu (#828): giriş (kamera, "Şaseden getir",
 * ruhsat kartı) 403'e gitmek yerine burada durur. Satın alma akışı gelene kadar
 * (#827) tek eylem destek hattıdır; sayfa kilidiyle aynı mesajı taşır.
 */
export function AddonLockedNote({ feature, className }: { feature: AddonFeature; className?: string }) {
  const { name } = FEATURE_CATALOG[feature]
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {name}
            <Badge variant="secondary">{lockedFeatureLabels(feature).label}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            Pakete dahil değil; yakında uygulama içinden satın alınabilecek.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
        <Link href={getSupportWhatsAppUrl(addonContactMessage(feature))} target="_blank" rel="noopener noreferrer">
          Bilgi alın
          <span className="sr-only">: {name}</span>
        </Link>
      </Button>
    </div>
  )
}

/**
 * Ek özelliğe bağlı bir girişi yetkiye göre çizer: açıksa `children`, kapalıysa
 * (yönetici rollerinde) {@link AddonLockedNote}, saha rollerinde hiçbir şey.
 * Hook'suz; yetki sunucuda `resolveIntakeEntitlements` ile hesaplanır.
 */
export function AddonGate({
  feature,
  enabled,
  showUpsell,
  className,
  children,
}: {
  feature: AddonFeature
  enabled: boolean
  showUpsell: boolean
  /** Yalnız kilit notuna uygulanır. */
  className?: string
  children: ReactNode
}) {
  if (enabled) return <>{children}</>
  return showUpsell ? <AddonLockedNote feature={feature} className={className} /> : null
}
