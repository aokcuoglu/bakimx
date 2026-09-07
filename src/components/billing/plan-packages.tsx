"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, CircleCheck, MessageCircle, Minus, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  PHOTO_UPLOAD_POLICY,
  PLAN_COMPARISON,
  PLAN_PACKAGES,
  type PlanComparisonValue,
} from "@/lib/plans-catalog"
import type { PlanTier, SalePlanTier } from "@/lib/plan"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { cn } from "@/lib/utils"

type BillingCycle = "monthly" | "yearly"

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP

function whatsappHref(message: string) {
  const text = encodeURIComponent(message)
  return SUPPORT_WA ? `https://wa.me/${SUPPORT_WA}?text=${text}` : `https://wa.me/?text=${text}`
}

function ComparisonValue({ value }: { value: PlanComparisonValue }) {
  if (value.state === "coming-soon") {
    return <Badge variant="secondary">Yakında</Badge>
  }
  if (value.state === "unavailable") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus className="size-4" aria-hidden="true" /> {value.label}
      </span>
    )
  }
  if (value.state === "included") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CircleCheck className="size-4 text-primary" aria-hidden="true" /> {value.label}
      </span>
    )
  }
  return <span>{value.label}</span>
}

function PlanAction({
  tier,
  billing,
  checkoutBasePath,
  ownedTier,
  hasPendingOrder,
  canPurchase,
  compact = false,
}: {
  tier: SalePlanTier
  billing: BillingCycle
  checkoutBasePath: string
  ownedTier: PlanTier | null
  hasPendingOrder: boolean
  canPurchase: boolean
  compact?: boolean
}) {
  const isOwned = ownedTier === tier
  const pkg = PLAN_PACKAGES.find((plan) => plan.tier === tier)!

  if (!canPurchase) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Paket değişikliği için yöneticinizle görüşün.
      </p>
    )
  }
  if (hasPendingOrder) {
    return (
      <Button type="button" disabled variant="outline" size={compact ? "sm" : "default"} className="w-full">
        Bekleyen talebiniz var
      </Button>
    )
  }

  const href = `${checkoutBasePath}?tier=${tier}&cycle=${billing}`
  return (
    <Button
      asChild
      variant={isOwned ? "secondary" : pkg.popular ? "default" : "outline"}
      size={compact ? "sm" : "default"}
      className="w-full"
    >
      <Link
        href={href}
        onClick={() =>
          trackMarketingEvent("purchase_started", {
            plan_tier: tier,
            billing_cycle: billing,
            cta_location: "pricing_card",
          })
        }
      >
        {isOwned && <Check className="size-4" aria-hidden="true" />}
        {isOwned ? "Mevcut paket · Yenile" : checkoutBasePath.startsWith("/register") ? "Ücretsiz dene" : "Bu paketi seç"}
      </Link>
    </Button>
  )
}

function PlanHeading({
  tier,
  billing,
  ownedTier,
}: {
  tier: SalePlanTier
  billing: BillingCycle
  ownedTier: PlanTier | null
}) {
  const pkg = PLAN_PACKAGES.find((plan) => plan.tier === tier)!
  return (
    <div className="space-y-2">
      <div className="flex min-h-6 flex-wrap items-center justify-center gap-1.5">
        <span className="font-semibold text-foreground">{pkg.name}</span>
        {pkg.popular && <Badge>En popüler</Badge>}
        {ownedTier === tier && <Badge variant="outline">Mevcut paket</Badge>}
      </div>
      <p className="min-h-10 text-xs leading-5 text-muted-foreground">{pkg.tagline}</p>
      <div>
        {pkg.listMonthlyLabel && (
          <s className="mr-1.5 text-xs text-muted-foreground">
            {billing === "monthly" ? pkg.listMonthlyLabel : pkg.listYearlyLabel}
          </s>
        )}
        <span className="text-xl font-bold text-foreground">
          {billing === "monthly" ? pkg.monthlyLabel : pkg.yearlyLabel}
        </span>
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">KDV dahil</span>
        {pkg.tier === "lite" && (
          <span className="mt-1 block text-xs font-medium text-primary">Açılışa özel · sınırlı süre</span>
        )}
      </div>
    </div>
  )
}

export function PlanPackages({
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/checkout",
  hasPendingOrder = false,
  canPurchase = true,
}: {
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
  /** A pending-payment order already exists — block new requests until it's confirmed/cancelled. */
  hasPendingOrder?: boolean
  /** Billing viewers without billing.manage can compare, but cannot start checkout. */
  canPurchase?: boolean
}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly")

  return (
    <section aria-labelledby="plan-karsilastirma-baslik" className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 id="plan-karsilastirma-baslik" className="text-xl font-bold text-foreground sm:text-2xl">
          Paketleri karşılaştırın
        </h2>
        <p className="text-sm text-muted-foreground">Fiyatı, kullanım limitlerini ve özellikleri yan yana inceleyin.</p>
      </div>

      <div className="flex justify-center pt-2">
        <div className="relative">
          <Badge className="absolute -top-3 left-3/4 z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 text-[10px]">
            <Sparkles className="size-3" aria-hidden="true" /> Yıllıkta 2 ay bedava
          </Badge>
          <ToggleGroup
            type="single"
            spacing={1}
            aria-label="Faturalama dönemi"
            className="grid w-64 grid-cols-2 rounded-lg border bg-card p-1"
            value={billing}
            onValueChange={(value) => {
              if (value) setBilling(value as BillingCycle)
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

      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-[28%] px-5 py-5 align-top whitespace-normal">
                Özellik ve limit
              </TableHead>
              {PLAN_PACKAGES.map((pkg) => (
                <TableHead
                  key={pkg.tier}
                  scope="col"
                  className={cn(
                    "w-[24%] px-4 py-5 text-center align-top whitespace-normal",
                    pkg.popular && "bg-primary/5",
                  )}
                >
                  <PlanHeading tier={pkg.tier} billing={billing} ownedTier={ownedTier} />
                  <div className="mt-4">
                    <PlanAction
                      tier={pkg.tier}
                      billing={billing}
                      checkoutBasePath={checkoutBasePath}
                      ownedTier={ownedTier}
                      hasPendingOrder={hasPendingOrder}
                      canPurchase={canPurchase}
                      compact
                    />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {PLAN_COMPARISON.map((category) => (
            <TableBody key={category.key}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead scope="rowgroup" colSpan={4} className="h-auto px-5 py-2.5 text-xs font-semibold uppercase tracking-wide">
                  {category.label}
                </TableHead>
              </TableRow>
              {category.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableHead scope="row" className="h-auto px-5 py-3 font-medium whitespace-normal">
                    {row.label}
                    {row.description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.description}</span>}
                  </TableHead>
                  {PLAN_PACKAGES.map((pkg) => (
                    <TableCell
                      key={pkg.tier}
                      className={cn("px-4 py-3 text-center whitespace-normal", pkg.popular && "bg-primary/5")}
                    >
                      <ComparisonValue value={row.values[pkg.tier]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>

      <Tabs defaultValue="pro" className="lg:hidden">
        <TabsList className="grid h-auto w-full grid-cols-3">
          {PLAN_PACKAGES.map((pkg) => (
            <TabsTrigger key={pkg.tier} value={pkg.tier} className="min-h-10 px-2">
              {pkg.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {PLAN_PACKAGES.map((pkg) => (
          <TabsContent key={pkg.tier} value={pkg.tier} className="space-y-4 rounded-xl border bg-card p-4">
            <PlanHeading tier={pkg.tier} billing={billing} ownedTier={ownedTier} />
            <PlanAction
              tier={pkg.tier}
              billing={billing}
              checkoutBasePath={checkoutBasePath}
              ownedTier={ownedTier}
              hasPendingOrder={hasPendingOrder}
              canPurchase={canPurchase}
            />
            {PLAN_COMPARISON.map((category) => (
              <section key={category.key} aria-labelledby={`mobil-${pkg.tier}-${category.key}`} className="space-y-2">
                <h3 id={`mobil-${pkg.tier}-${category.key}`} className="border-b pb-2 text-sm font-semibold text-foreground">
                  {category.label}
                </h3>
                <dl className="divide-y">
                  {category.rows.map((row) => (
                    <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
                      <dt className="min-w-0 text-sm text-foreground">
                        {row.label}
                        {row.description && <span className="mt-0.5 block text-xs text-muted-foreground">{row.description}</span>}
                      </dt>
                      <dd className="text-right text-sm font-medium"><ComparisonValue value={row.values[pkg.tier]} /></dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">Fotoğraf yükleme kuralları</p>
        <p>
          Tek seçimde en fazla {PHOTO_UPLOAD_POLICY.maxPerSelection} fotoğraf ve fotoğraf başına en fazla{" "}
          {PHOTO_UPLOAD_POLICY.rawSelectionMb} MB ham dosya seçilebilir. İstemci yaklaşık{" "}
          {PHOTO_UPLOAD_POLICY.compressionTargetMb} MB hedefiyle sıkıştırır; sunucu sınırı{" "}
          {PHOTO_UPLOAD_POLICY.serverLimitMb} MB’dir.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {checkoutBasePath.startsWith("/register")
          ? "Kart bilgisi istemiyoruz. Önce ücretsiz deneyin; deneme bitince uygulama içinden paketinizi etkinleştirirsiniz. "
          : "Ücretli paketlerde Havale/EFT veya kart ile ödeyin; ödemeniz teyit edilince paketiniz aktifleşir. "}
        <a
          href={whatsappHref(`Merhaba, BakimX paket etkinleştirme hakkında bilgi almak istiyorum.${workshopName ? ` (${workshopName})` : ""}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <MessageCircle className="size-3" aria-hidden="true" /> WhatsApp ile iletişim
        </a>
      </p>
    </section>
  )
}
