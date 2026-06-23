"use client"

import { useState, useTransition } from "react"
import { Check, CircleCheck, Loader2, MessageCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { PLAN_PACKAGES, getPlanPackage } from "@/lib/plans-catalog"
import type { PlanTier } from "@/lib/plan"
import { requestPlanActivation } from "@/app/app/billing/actions"

type BillingCycle = "monthly" | "yearly"

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP // digits only, e.g. 905551112233

function whatsappHref(message: string) {
  const text = encodeURIComponent(message)
  return SUPPORT_WA ? `https://wa.me/${SUPPORT_WA}?text=${text}` : `https://wa.me/?text=${text}`
}

export function PlanPackages({
  ownedTier = null,
  requestedTier = null,
  workshopName,
}: {
  ownedTier?: PlanTier | null
  requestedTier?: PlanTier | null
  workshopName?: string
}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const [pending, startTransition] = useTransition()
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null)
  const [requested, setRequested] = useState<PlanTier | null>(requestedTier)
  const [error, setError] = useState("")

  function handleSelect(tier: PlanTier) {
    setError("")
    setPendingTier(tier)
    startTransition(async () => {
      const res = await requestPlanActivation(tier)
      if (res.ok) {
        setRequested(tier)
      } else {
        setError(res.error)
      }
      setPendingTier(null)
    })
  }

  const requestedPkg = requested ? getPlanPackage(requested) : null

  return (
    <div className="space-y-5">
      {requested && requestedPkg && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-foreground">
            <span className="font-semibold">{requestedPkg.name}</span> paketi için talebiniz alındı 🎉
          </p>
          <p className="mt-1 text-muted-foreground">
            En kısa sürede etkinleştireceğiz. Hızlandırmak için bize yazabilirsiniz:{" "}
            <a
              href={whatsappHref(
                `Merhaba, ${workshopName ? `${workshopName} için ` : ""}${requestedPkg.name} paketini etkinleştirmek istiyorum.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              WhatsApp
            </a>
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3">
          {error}
        </div>
      )}

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
          const isRequested = requested === pkg.tier
          const isBusy = pending && pendingTier === pkg.tier

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
                <span className="block text-[11px] text-muted-foreground mt-0.5">+ KDV</span>
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
                <div className="inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                  <Check className="size-4" /> Mevcut paketiniz
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSelect(pkg.tier)}
                  className={cn(
                    buttonVariants({ variant: pkg.popular ? "default" : "outline", size: "default" }),
                    "w-full h-10",
                    isRequested && "border-primary/40"
                  )}
                >
                  {isBusy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Gönderiliyor...
                    </span>
                  ) : isRequested ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="size-4" /> Talep edildi
                    </span>
                  ) : (
                    "Bu paketi seç"
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ödeme altyapısı yakında. Şimdilik paketi seçtiğinizde ekibimiz hesabınızı en kısa sürede
        etkinleştirir.{" "}
        <a
          href={whatsappHref("Merhaba, BakimX paket etkinleştirme hakkında bilgi almak istiyorum.")}
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
