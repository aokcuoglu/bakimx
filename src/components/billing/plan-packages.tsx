"use client"

import { useState } from "react"
import { Check, CircleCheck, MessageCircle, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { VIN_LOOKUP_QUOTA } from "@/lib/plan"
import type { PlanTier } from "@/lib/plan"
import { trackMarketingEvent } from "@/lib/marketing-analytics"

type BillingCycle = "monthly" | "yearly"

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP // digits only, e.g. 905551112233

function whatsappHref(message: string) {
  const text = encodeURIComponent(message)
  return SUPPORT_WA ? `https://wa.me/${SUPPORT_WA}?text=${text}` : `https://wa.me/?text=${text}`
}

export function PlanPackages({
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/checkout",
  hasPendingOrder = false,
}: {
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
  /** A pending-payment order already exists — block new requests until it's confirmed/cancelled. */
  hasPendingOrder?: boolean
}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const [highlightedTier, setHighlightedTier] = useState<PlanTier | null>(null)
  const router = useRouter()

  function handleSelect(tier: PlanTier) {
    trackMarketingEvent("purchase_started", { plan_tier: tier, billing_cycle: billing, cta_location: "pricing_card" })
    router.push(`${checkoutBasePath}?tier=${tier}&cycle=${billing}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center pt-2">
        <div className="relative">
          <Badge className="absolute -top-3 left-3/4 z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-[10px]">
            <Sparkles className="size-3" /> Yıllıkta 2 ay bedava
          </Badge>
          <ToggleGroup
            type="single"
            spacing={1}
            className="grid w-64 grid-cols-2 rounded-lg border bg-card p-1"
            value={billing}
            onValueChange={(v) => {
              if (v) setBilling(v as BillingCycle)
            }}
          >
            {(["monthly", "yearly"] as const).map((cycle) => (
              <ToggleGroupItem
                key={cycle}
                value={cycle}
                className="w-full rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:text-foreground"
              >
                {cycle === "monthly" ? "Aylık" : "Yıllık"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {PLAN_PACKAGES.map((pkg) => {
          const isOwned = ownedTier === pkg.tier
          const isCtaHighlighted = highlightedTier === pkg.tier || (highlightedTier === null && pkg.popular)

          return (
            <div
              key={pkg.tier}
              onMouseEnter={() => setHighlightedTier(pkg.tier)}
              onMouseLeave={() => setHighlightedTier(null)}
              onFocusCapture={() => setHighlightedTier(pkg.tier)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setHighlightedTier(null)
                }
              }}
              className={cn(
                "group/card relative flex flex-col rounded-xl border bg-card p-6 transition-[transform,box-shadow,border-color] duration-200 ease-out motion-safe:hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 focus-within:border-primary/60 focus-within:shadow-lg focus-within:shadow-primary/10",
                pkg.popular ? "border-primary shadow-sm" : "border-border"
              )}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  <Sparkles className="size-3" /> En popüler
                </span>
              )}

              <div className="mb-3">
                <h3 className="font-semibold text-base text-foreground transition-colors duration-200 group-hover/card:text-primary group-focus-within/card:text-primary">
                  {pkg.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{pkg.tagline}</p>
              </div>

              <div className="mb-3">
                <span className="text-2xl font-bold text-foreground">
                  {billing === "monthly" ? pkg.monthlyLabel : pkg.yearlyLabel}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">KDV dahil</span>
              </div>

              <p className="mb-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{pkg.seats} kullanıcı</span> dahil · ek koltuk eklenebilir
              </p>

              {VIN_LOOKUP_QUOTA[pkg.tier] > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{VIN_LOOKUP_QUOTA[pkg.tier].toLocaleString("tr-TR")} kota/ay</span> VIN & katalog sorgusu
                </p>
              )}

              <ul className="space-y-2 mb-5 flex-1">
                {pkg.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-foreground">
                    <CircleCheck className="size-4 text-primary shrink-0 mt-0.5 transition-transform duration-200 motion-safe:group-hover/card:scale-110 motion-safe:group-focus-within/card:scale-110" />
                    <span className="leading-snug">{h}</span>
                  </li>
                ))}
              </ul>

              {hasPendingOrder ? (
                <Button type="button" disabled variant="outline" size="lg" className="w-full">
                  Bekleyen talebiniz var
                </Button>
              ) : isOwned ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => handleSelect(pkg.tier)}
                >
                  <Check className="size-4" /> Yenile
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={isCtaHighlighted ? "default" : "outline"}
                  size="lg"
                  className="w-full transition-[transform,box-shadow,background-color,border-color,color] duration-200 group-hover/card:border-primary group-hover/card:bg-primary group-hover/card:text-primary-foreground group-hover/card:shadow-sm group-focus-within/card:border-primary group-focus-within/card:bg-primary group-focus-within/card:text-primary-foreground group-focus-within/card:shadow-sm motion-safe:active:scale-[0.98]"
                  onClick={() => handleSelect(pkg.tier)}
                >
                  Bu paketi seç
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Havale/EFT ile ödeyin; ödemeniz teyit edilince paketiniz aktifleşir.{" "}
        <a
          href={whatsappHref(`Merhaba, BakimX paket etkinleştirme hakkında bilgi almak istiyorum.${workshopName ? ` (${workshopName})` : ""}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <MessageCircle className="size-3" /> WhatsApp ile iletişim
        </a>
      </p>
    </div>
  )
}
