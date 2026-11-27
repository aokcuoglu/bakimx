"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { ChevronRight, LockKeyhole } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { addonPurchaseHref, purchasableAddonKeyForFeature } from "@/lib/billing/addon-purchase"
import { FEATURE_CATALOG, addonContactMessage, lockedFeatureLabels } from "@/lib/feature-catalog"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import type { AddonFeature } from "@/lib/plan"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"

/**
 * Kilitli ek özelliğin satır içi notu (#828): giriş (kamera, "Şaseden getir",
 * ruhsat kartı) 403'e gitmek yerine burada durur.
 *
 * Form içinde yer kaplamasın diye tek satır ve çerçevesiz (e-santral: gölge
 * yok, çerçeve yok); telefonda sarılır. Açıklama cümlesi yok.
 *
 * Satın alınabilen ek özellikte eylem "Satın al"dır ve Ayarlar → Paketler'deki
 * satın alma penceresini açar (#829); satılmayanlarda "Bilgi alın" destek
 * hattına gider. Görüntülenme ve tıklama huni analitiğine gider (#828).
 *
 * Eylem e-santral'ın ikincil eylemi gibi metin bağlantısıdır; satırı
 * şişirmemek için görünür boyu küçüktür, dokunma alanı ise şeffaf bir
 * `::before` katmanıyla telefonda 44px'e çıkar (#810 `PillButton size="nav"`
 * emsali, docs/ui-control-sizing.md). Masaüstünde (md+) katman kapanır.
 */
export function AddonLockedNote({ feature, className }: { feature: AddonFeature; className?: string }) {
  const { name } = FEATURE_CATALOG[feature]
  const purchaseKey = purchasableAddonKeyForFeature(feature)

  useEffect(() => {
    trackMarketingEvent("feature_paywall_viewed", { feature_id: feature, kind: "addon", placement: "inline" })
  }, [feature])

  function trackClick(destination: "addon_purchase" | "contact") {
    trackMarketingEvent("feature_upgrade_clicked", {
      feature_id: feature,
      kind: "addon",
      placement: "inline",
      destination,
    })
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      <LockKeyhole className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="font-medium text-foreground">{name}</span>
      <Badge variant="secondary">{lockedFeatureLabels(feature).label}</Badge>
      <Button
        asChild
        variant="link"
        size="sm"
        className="relative ml-auto gap-0.5 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:min-h-full before:-translate-y-1/2 md:before:hidden"
      >
        {purchaseKey ? (
          <Link href={addonPurchaseHref(purchaseKey)} onClick={() => trackClick("addon_purchase")}>
            Satın al
            <ChevronRight aria-hidden="true" />
            <span className="sr-only">: {name}</span>
          </Link>
        ) : (
          <Link
            href={getSupportWhatsAppUrl(addonContactMessage(feature))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick("contact")}
          >
            Bilgi alın
            <ChevronRight aria-hidden="true" />
            <span className="sr-only">: {name}, yeni sekmede açılır</span>
          </Link>
        )}
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
