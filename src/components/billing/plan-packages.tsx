"use client"

import { useState } from "react"
import { PriceRoll } from "./price-roll"
import Link from "next/link"
import { Check, CircleCheck, MessageCircle, Minus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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
  LITE_CAMPAIGN_DESCRIPTION,
  PLAN_COMPARISON,
  PLAN_PACKAGES,
  type PlanComparisonValue,
} from "@/lib/plans-catalog"
import type { PlanTier, SalePlanTier } from "@/lib/plan"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"

type BillingCycle = "monthly" | "yearly"

function BillingPeriod({
  billing,
  onChange,
  subdued = false,
  label = "Faturalama dönemi",
  showYearlyBonus = false,
}: {
  billing: BillingCycle
  onChange: (value: BillingCycle) => void
  subdued?: boolean
  label?: string
  /** Floating “2 ay bedava” chip on the Yearly segment (Attio-style plans header). */
  showYearlyBonus?: boolean
}) {
  return (
    <div className={cn("relative", showYearlyBonus && "pt-3")}>
      {showYearlyBonus && (
        <Badge
          variant="outline"
          className="absolute right-0 top-0 z-10 rounded-full border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm"
        >
          2 ay bedava
        </Badge>
      )}
      <ToggleGroup
        type="single"
        spacing={1}
        aria-label={label}
        className={cn(
          "grid w-64 grid-cols-2 rounded-lg border bg-card p-1",
          subdued && "w-48 rounded-xl border-0 bg-muted p-0.5",
        )}
        value={billing}
        onValueChange={(value) => {
          if (value) onChange(value as BillingCycle)
        }}
      >
        {(["monthly", "yearly"] as const).map((cycle) => (
          <ToggleGroupItem
            key={cycle}
            value={cycle}
            className={cn(
              "w-full rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm hover:text-foreground",
              subdued && "h-9 rounded-[10px]",
            )}
          >
            {cycle === "monthly" ? "Aylık" : "Yıllık"}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function ComparisonValue({ value, minimal = false }: { value: PlanComparisonValue; minimal?: boolean }) {
  if (minimal && (value.state === "included" || value.state === "unavailable")) {
    return (
      <span className="inline-flex items-center justify-center">
        {value.state === "included"
          ? <CircleCheck className="size-3.5 fill-muted-foreground text-card" aria-hidden="true" />
          : <X className="size-3.5 text-muted-foreground" aria-hidden="true" />}
        <span className="sr-only">{value.label}</span>
      </span>
    )
  }
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
  publicCard = false,
  liteRegistrationOpen = true,
  onSelectPlan,
}: {
  tier: SalePlanTier
  billing: BillingCycle
  checkoutBasePath: string
  ownedTier: PlanTier | null
  hasPendingOrder: boolean
  canPurchase: boolean
  compact?: boolean
  publicCard?: boolean
  liteRegistrationOpen?: boolean
  onSelectPlan?: (tier: SalePlanTier, cycle: BillingCycle) => void
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

  if (tier === "lite" && checkoutBasePath.startsWith("/register") && !liteRegistrationOpen) {
    return <p role="status" className="text-sm text-muted-foreground">Yeni Lite kayıtları kapalı. Mevcut üyelerin ücretsiz kullanımı devam ediyor.</p>
  }

  const href = `${checkoutBasePath}?tier=${tier}&cycle=${billing}`
  const label = isOwned ? "Mevcut paket · Yenile" : checkoutBasePath.startsWith("/register") ? tier === "lite" ? "Ücretsiz hesap oluştur" : "Ücretsiz dene" : "Bu paketi seç"
  const trackSelection = () => trackMarketingEvent(tier === "lite" && checkoutBasePath.startsWith("/register") ? "lite_cta_click" : "purchase_started", {
    plan_tier: tier,
    billing_cycle: billing,
    cta_location: "pricing_card",
  })
  if (onSelectPlan) {
    return (
      <Button type="button" variant={isOwned ? "secondary" : pkg.popular ? "foreground" : "outline"} size={compact ? "sm" : "default"} className="w-full" onClick={() => { trackSelection(); onSelectPlan(tier, billing) }}>
        {isOwned && <Check className="size-4" aria-hidden="true" />}{label}
      </Button>
    )
  }
  return (
    <Button
      asChild
      variant={isOwned ? "secondary" : pkg.popular ? publicCard ? "navy" : "foreground" : "outline"}
      size={compact ? "sm" : "default"}
      className={cn("w-full", publicCard && "h-9 text-sm font-normal", publicCard && !pkg.popular && "bg-card")}
    >
      <Link
        href={href}
        onClick={trackSelection}
      >
        {isOwned && <Check className="size-4" aria-hidden="true" />}
        {label}
      </Link>
    </Button>
  )
}

function PlanHeading({
  tier,
  billing,
  ownedTier,
  centered = true,
  trialTier = null,
}: {
  tier: SalePlanTier
  billing: BillingCycle
  ownedTier: PlanTier | null
  centered?: boolean
  trialTier?: SalePlanTier | null
}) {
  const pkg = PLAN_PACKAGES.find((plan) => plan.tier === tier)!
  return (
    <div className="space-y-2">
      <div className={cn("flex min-h-6 flex-wrap items-center gap-1.5", centered && "justify-center")}>
        <span className="font-semibold text-foreground">{pkg.name}</span>
        {pkg.popular && <Badge>En popüler</Badge>}
        {ownedTier === tier && <Badge variant="outline">Mevcut paket</Badge>}
        {trialTier === tier && <Badge variant="outline">Deneme hakları</Badge>}
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
          <span className="mt-1 block text-xs font-medium text-primary">Açılışa özel ücretsiz kayıt</span>
        )}
      </div>
      {tier === "lite" && centered && <p className="text-xs leading-5 text-muted-foreground">{LITE_CAMPAIGN_DESCRIPTION}</p>}
    </div>
  )
}

/** Attio-style pricing cards used on /settings/plans (and plan-locked). */
function SettingsPlanCards({
  billing,
  ownedTier,
  hasPendingOrder,
  canPurchase,
  liteRegistrationOpen,
  checkoutBasePath,
  onSelectPlan,
  trialTier,
}: {
  billing: BillingCycle
  ownedTier: PlanTier | null
  hasPendingOrder: boolean
  canPurchase: boolean
  liteRegistrationOpen: boolean
  checkoutBasePath: string
  onSelectPlan?: (tier: SalePlanTier, cycle: BillingCycle) => void
  trialTier: SalePlanTier | null
}) {
  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-3" aria-label="Paketler">
      {PLAN_PACKAGES.map((pkg) => {
        const isOwned = ownedTier === pkg.tier
        const priceAmount =
          pkg.tier === "lite"
            ? "₺0"
            : `₺${(billing === "monthly" ? pkg.monthlyPrice : pkg.yearlyPrice).toLocaleString("tr-TR")}`
        const period = billing === "monthly" ? "/ay" : "/yıl"
        return (
          <div
            key={pkg.tier}
            role="article"
            aria-labelledby={`settings-paket-${pkg.tier}`}
            className={cn(
              "relative flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm",
              pkg.popular && "border-foreground/15 shadow-md ring-1 ring-foreground/10",
            )}
          >
            <div className="flex min-h-7 flex-wrap items-center gap-2">
              <h3 id={`settings-paket-${pkg.tier}`} className="text-base font-semibold tracking-tight text-foreground">
                {pkg.name}
              </h3>
              {pkg.popular && (
                <Badge variant="outline" className="rounded-full border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                  Popüler
                </Badge>
              )}
              {isOwned && <Badge variant="outline">Mevcut paket</Badge>}
              {trialTier === pkg.tier && <Badge variant="outline">Deneme hakları</Badge>}
            </div>

            <div className="mt-5" aria-live="polite" aria-atomic="true">
              <div className="flex flex-wrap items-baseline gap-1.5">
                {pkg.listMonthlyLabel && (
                  <s className="text-sm text-muted-foreground">
                    {billing === "monthly" ? pkg.listMonthlyLabel : pkg.listYearlyLabel}
                  </s>
                )}
                <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-foreground">
                  {priceAmount}
                </p>
                <span className="text-sm text-muted-foreground">{period}</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {pkg.tier === "lite"
                  ? "Lite kampanyasında süresiz ücretsiz"
                  : billing === "yearly"
                    ? "Yıllık faturalandırılır · KDV dahil"
                    : "Aylık faturalandırılır · KDV dahil"}
              </p>
            </div>

            <p className="mt-5 text-sm leading-5 text-muted-foreground">{pkg.tagline}</p>

            <div className="mt-6">
              <PlanAction
                tier={pkg.tier}
                billing={billing}
                checkoutBasePath={checkoutBasePath}
                ownedTier={ownedTier}
                hasPendingOrder={hasPendingOrder}
                canPurchase={canPurchase}
                liteRegistrationOpen={liteRegistrationOpen}
                onSelectPlan={onSelectPlan}
              />
            </div>

            <ul className="mt-8 space-y-3 border-t border-border/70 pt-6">
              {pkg.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2.5 text-sm leading-5 text-foreground">
                  <CircleCheck
                    className="mt-0.5 size-4 shrink-0 fill-success text-success-foreground"
                    aria-hidden="true"
                  />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function PlanPackages({
  presentation = "comparison",
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/checkout",
  hasPendingOrder = false,
  canPurchase = true,
  liteRegistrationOpen = true,
  onSelectPlan,
  trialTier = null,
}: {
  presentation?: "comparison" | "public"
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
  /** A pending-payment order already exists — block new requests until it's confirmed/cancelled. */
  hasPendingOrder?: boolean
  /** Billing viewers without billing.manage can compare, but cannot start checkout. */
  canPurchase?: boolean
  liteRegistrationOpen?: boolean
  onSelectPlan?: (tier: SalePlanTier, cycle: BillingCycle) => void
  trialTier?: SalePlanTier | null
}) {
  const isPublic = presentation === "public"
  const [billing, setBilling] = useState<BillingCycle>(isPublic ? "monthly" : "yearly")

  return (
    <section id="lite" aria-label="Paketleri karşılaştırın" className="scroll-mt-20 space-y-5">
      {isPublic ? (
        <>
          <div className="sr-only space-y-1 text-center">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Paketleri karşılaştırın</h2>
            <p className="text-sm text-muted-foreground">Fiyatı, kullanım limitlerini ve özellikleri yan yana inceleyin.</p>
          </div>
          <div className="flex justify-center pt-2">
            <BillingPeriod billing={billing} onChange={setBilling} subdued />
          </div>
          <div className="relative !mt-16 grid gap-6 border-y border-border/50 px-3 py-3 md:grid-cols-3 before:pointer-events-none before:absolute before:-inset-y-10 before:inset-x-0 before:border-x before:border-border/40" aria-label="Paketler">
            <span aria-hidden="true" className="pointer-events-none absolute -left-1 -top-2 text-xs text-border">+</span>
            <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-2 text-xs text-border">+</span>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 -left-1 text-xs text-border">+</span>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 -right-1 text-xs text-border">+</span>
            {PLAN_PACKAGES.map((pkg) => (
              <div key={pkg.tier} className="relative before:pointer-events-none before:absolute before:-inset-y-14 before:-left-3 before:hidden before:border-l before:border-border/40 md:before:block first:before:border-0">
                <Card
                  role="article"
                  aria-labelledby={`paket-${pkg.tier}`}
                  className={cn("relative h-full min-h-[400px] gap-0 overflow-visible rounded-xl border border-border/70 p-6 shadow-sm ring-0", pkg.popular && "border-foreground/20 ring-2 ring-foreground/10")}
                >
                  <h3 id={`paket-${pkg.tier}`} className="text-xl font-medium tracking-tight">{pkg.name}</h3>
                  <div className="mt-7" aria-live="polite" aria-atomic="true">
                    <div className="flex min-h-12 flex-wrap items-center gap-3">
                      <p className="flex items-baseline text-[40px] font-semibold leading-[48px] tracking-[-0.025em]">
                        {pkg.tier === "lite" ? "0 TL" : (
                          <>
                            <span>₺</span>
                            <PriceRoll
                              monthly={pkg.monthlyPrice.toLocaleString("tr-TR")}
                              yearly={pkg.yearlyPrice.toLocaleString("tr-TR")}
                              cycle={billing}
                            />
                          </>
                        )}
                      </p>
                      {pkg.tier !== "lite" && billing === "yearly" && <Badge variant="outline" className="rounded-sm border-border bg-muted text-foreground font-normal">2 ay bedava</Badge>}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{pkg.tier === "lite" ? "Lite kampanyasında süresiz ücretsiz" : billing === "monthly" ? "Aylık faturalandırılır · KDV dahil" : "Yıllık faturalandırılır · KDV dahil"}</p>
                  </div>
                  <p className="mt-8 min-h-10 text-sm font-medium leading-5">{pkg.tagline}</p>
                  <ul className="mb-8 mt-2.5 space-y-2.5">
                    {pkg.highlights.slice(0, 3).map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 rounded-[5px] bg-muted text-muted-foreground" aria-hidden="true" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <PlanAction publicCard tier={pkg.tier} billing={billing} checkoutBasePath={checkoutBasePath} ownedTier={ownedTier} hasPendingOrder={hasPendingOrder} canPurchase={canPurchase} liteRegistrationOpen={liteRegistrationOpen} onSelectPlan={onSelectPlan} />
                  </div>
                </Card>
              </div>
            ))}
          </div>
          <div className="mx-auto max-w-3xl !mt-16 space-y-3 text-center text-xs leading-5 text-muted-foreground">
            <p>Ücretli paketlerde kart bilgisi olmadan 7 iş günü deneme. Yıllık ödemede 2 ay bedava. Tüm fiyatlara KDV dahildir.</p>
            <p>{LITE_CAMPAIGN_DESCRIPTION} Otomatik ücretliye dönüşmez. Ücretli paketi kendi onayınızla etkinleştirirsiniz.</p>
          </div>
          <div className="pb-6 pt-16 text-center sm:pt-24">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Her paketin detayını karşılaştırın.</h2>
            <p className="mt-3 text-sm text-muted-foreground">Servisinizin ihtiyaçlarına göre özellikleri ve kullanım limitlerini inceleyin.</p>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Paketler</h2>
            <BillingPeriod billing={billing} onChange={setBilling} showYearlyBonus label="Faturalama dönemi" />
          </div>
          <SettingsPlanCards
            billing={billing}
            ownedTier={ownedTier}
            hasPendingOrder={hasPendingOrder}
            canPurchase={canPurchase}
            liteRegistrationOpen={liteRegistrationOpen}
            checkoutBasePath={checkoutBasePath}
            onSelectPlan={onSelectPlan}
            trialTier={trialTier}
          />
        </div>
      )}

      <div className={cn("hidden lg:block", !isPublic && "overflow-hidden rounded-xl border bg-card")}>
        {!isPublic && (
          <div className="border-b px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">Detaylı karşılaştırma</h3>
            <p className="mt-1 text-xs text-muted-foreground">Özellikleri ve kullanım limitlerini satır satır inceleyin.</p>
          </div>
        )}
        <Table aria-label="Paket özelliklerini karşılaştırın" className="table-fixed" containerClassName={isPublic ? "overflow-visible" : undefined}>
          <TableHeader className={isPublic ? "sticky top-[68px] z-30 bg-card shadow-[0_1px_0_var(--border)]" : undefined}>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-[28%] px-5 py-5 align-top whitespace-normal">
                {isPublic ? (
                  <div className="flex min-h-32 flex-col justify-end gap-4 pb-1">
                    <span className="text-xs leading-5 text-muted-foreground">Tercih ettiğiniz<br />ödeme dönemini seçin</span>
                    <div className="space-y-1">
                      <BillingPeriod billing={billing} onChange={setBilling} subdued label="Karşılaştırma faturalama dönemi" />
                      <p className="text-[11px] font-normal text-muted-foreground">Yıllık ödemede 2 ay bedava</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-24 flex-col justify-end gap-3">
                    <span className="text-xs font-normal text-muted-foreground">Özellik / limit</span>
                  </div>
                )}
              </TableHead>
              {PLAN_PACKAGES.map((pkg) => (
                <TableHead
                  key={pkg.tier}
                  scope="col"
                  className={cn(
                    "w-[24%] px-4 py-5 text-left align-top whitespace-normal",
                    !isPublic && (pkg.tier === trialTier || (!trialTier && pkg.popular)) && "bg-muted/50",
                  )}
                >
                  {isPublic ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-medium tracking-tight">{pkg.name}</span>
                        {pkg.popular && <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary-strong font-normal">Popüler</Badge>}
                      </div>
                      <p className="min-h-10 text-xs font-normal leading-5 text-muted-foreground">
                        {billing === "monthly" ? pkg.monthlyLabel : pkg.yearlyLabel} · KDV dahil<br />
                        {pkg.tier === "lite" ? "Lite kampanyasında ücretsiz" : billing === "monthly" ? "Aylık faturalandırılır" : "Yıllık faturalandırılır"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">{pkg.name}</span>
                        {pkg.popular && <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">Popüler</Badge>}
                        {ownedTier === pkg.tier && <Badge variant="outline">Mevcut</Badge>}
                      </div>
                      <p className="text-xs font-normal text-muted-foreground">
                        {billing === "monthly" ? pkg.monthlyLabel : pkg.yearlyLabel}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <PlanAction
                      tier={pkg.tier}
                      billing={billing}
                      checkoutBasePath={checkoutBasePath}
                      ownedTier={ownedTier}
                      hasPendingOrder={hasPendingOrder}
                      canPurchase={canPurchase}
                      liteRegistrationOpen={liteRegistrationOpen}
                      compact={!isPublic}
                      publicCard={isPublic}
                      onSelectPlan={onSelectPlan}
                    />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {PLAN_COMPARISON.map((category) => (
            <TableBody key={category.key}>
              <TableRow className={isPublic ? "border-border/60 hover:bg-transparent" : "bg-muted/50 hover:bg-muted/50"}>
                <TableHead scope="rowgroup" colSpan={4} className={cn("h-auto px-5", isPublic ? "pb-4 pt-12 text-lg font-medium tracking-tight" : "py-2.5 text-xs font-semibold uppercase tracking-wide")}>
                  {category.label}
                </TableHead>
              </TableRow>
              {category.rows.map((row) => (
                <TableRow key={row.key} className={isPublic ? "border-border/40 hover:bg-transparent" : undefined}>
                  <TableHead scope="row" className={cn("h-auto px-5 py-3 font-medium whitespace-normal", isPublic && "py-3.5 text-xs leading-5 text-muted-foreground")}>
                    {row.label}
                    {row.description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.description}</span>}
                  </TableHead>
                  {PLAN_PACKAGES.map((pkg) => (
                    <TableCell
                      key={pkg.tier}
                      className={cn(
                        "px-4 py-3 text-center whitespace-normal",
                        isPublic ? "py-3.5 text-xs text-muted-foreground" : "",
                        (pkg.tier === trialTier || (!trialTier && pkg.popular)) && (isPublic ? "bg-muted/40" : "bg-muted/50"),
                      )}
                    >
                      <ComparisonValue value={row.values[pkg.tier]} minimal={isPublic} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      </div>

      <Tabs defaultValue={trialTier ?? ownedTier ?? (checkoutBasePath.startsWith("/register") ? "lite" : "pro")} className={cn(isPublic ? "lg:hidden" : "hidden")}>
        <TabsList className={cn("grid h-auto w-full grid-cols-3", isPublic && "sticky top-[68px] z-30 border-b bg-card")}>
          {PLAN_PACKAGES.map((pkg) => (
            <TabsTrigger key={pkg.tier} value={pkg.tier} className="min-h-10 px-2">
              {pkg.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {PLAN_PACKAGES.map((pkg) => (
          <TabsContent key={pkg.tier} value={pkg.tier} className="space-y-4 rounded-xl border bg-card p-4">
            <PlanHeading tier={pkg.tier} billing={billing} ownedTier={ownedTier} trialTier={trialTier} />
            <PlanAction
              tier={pkg.tier}
              billing={billing}
              checkoutBasePath={checkoutBasePath}
              ownedTier={ownedTier}
              hasPendingOrder={hasPendingOrder}
              canPurchase={canPurchase}
              liteRegistrationOpen={liteRegistrationOpen}
              onSelectPlan={onSelectPlan}
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

      {!isPublic && (
        <details className="rounded-xl border bg-card lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            Detaylı özellik karşılaştırması
          </summary>
          <div className="space-y-4 border-t px-4 py-4">
            {PLAN_PACKAGES.map((pkg) => (
              <section key={pkg.tier} aria-labelledby={`mobil-detay-${pkg.tier}`} className="space-y-3">
                <h3 id={`mobil-detay-${pkg.tier}`} className="text-sm font-semibold">{pkg.name}</h3>
                {PLAN_COMPARISON.map((category) => (
                  <div key={category.key} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</p>
                    <dl className="divide-y rounded-lg border">
                      {category.rows.map((row) => (
                        <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                          <dt className="min-w-0 text-sm text-foreground">{row.label}</dt>
                          <dd className="text-right text-sm font-medium"><ComparisonValue value={row.values[pkg.tier]} /></dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">Fotoğraf yükleme kuralları</p>
        <p>
          Tek seçimde en fazla {PHOTO_UPLOAD_POLICY.maxPerSelection} fotoğraf ve fotoğraf başına en fazla{" "}
          {PHOTO_UPLOAD_POLICY.rawSelectionMb} MB ham dosya seçilebilir. İstemci yaklaşık{" "}
          {PHOTO_UPLOAD_POLICY.compressionTargetMb} MB hedefiyle sıkıştırır; sunucu sınırı{" "}
          {PHOTO_UPLOAD_POLICY.serverLimitMb} MB’dir.
        </p>
      </div>

      {!isPublic && <p className="text-xs leading-5 text-muted-foreground">{LITE_CAMPAIGN_DESCRIPTION}</p>}

      <p className="text-center text-xs text-muted-foreground">
        {checkoutBasePath.startsWith("/register")
          ? "Lite süresiz ücretsizdir; kart gerekmez ve otomatik ücretliye dönüşmez. Profesyonel ve Premium kayıtlarında mevcut 7 iş günlük deneme geçerlidir. "
          : "Ücretli paketlerde Havale/EFT veya kart ile ödeyin; ödemeniz teyit edilince paketiniz aktifleşir. "}
        <a
          href={getSupportWhatsAppUrl(`Merhaba, BakimX paket etkinleştirme hakkında bilgi almak istiyorum.${workshopName ? ` (${workshopName})` : ""}`)}
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
