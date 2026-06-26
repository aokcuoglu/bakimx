"use client"

import { useState } from "react"
import { Check, CircleCheck, MessageCircle, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import type { PlanTier } from "@/lib/plan"

type BillingCycle = "monthly" | "yearly"

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP // digits only, e.g. 905551112233

function whatsappHref(message: string) {
  const text = encodeURIComponent(message)
  return SUPPORT_WA ? `https://wa.me/${SUPPORT_WA}?text=${text}` : `https://wa.me/?text=${text}`
}

export function PlanPackages({
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/billing/checkout",
}: {
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const router = useRouter()

  function handleSelect(tier: PlanTier) {
    router.push(`${checkoutBasePath}?tier=${tier}&cycle=${billing}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border bg-card p-1 gap-1">
          {(["monthly", "yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                billing === cycle
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cycle === "monthly" ? "Aylık" : "Yıllık"}
              {cycle === "yearly" && billing === "yearly" && (
                <span className="text-[10px] font-semibold bg-primary/15 text-foreground px-1.5 py-0.5 rounded-full">
                  2 ay bedava
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLAN_PACKAGES.map((pkg) => {
          const isOwned = ownedTier === pkg.tier

          return (
            <div
              key={pkg.tier}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-5 transition-shadow",
                pkg.popular ? "border-primary shadow-sm" : "border-border"
              )}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  <Sparkles className="size-3" /> En popüler
                </span>
              )}

              <div className="mb-3">
                <h3 className="font-semibold text-base text-foreground">{pkg.name}</h3>
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

              <ul className="space-y-2 mb-5 flex-1">
                {pkg.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-foreground">
                    <CircleCheck className="size-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-snug">{h}</span>
                  </li>
                ))}
              </ul>

              {isOwned ? (
                <Button type="button" disabled variant="secondary" size="lg" className="w-full">
                  <Check className="size-4" /> Mevcut paketiniz
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={pkg.popular ? "default" : "outline"}
                  size="lg"
                  className="w-full"
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
