"use client"

import { useState } from "react"
import { PriceRoll } from "./price-roll"
import { BillingCycleToggle } from "./billing-cycle-toggle"
import Link from "next/link"
import { ArrowUpRight, Check, CircleCheck, Hexagon, MessageCircle, Minus, Pencil, PlusCircle } from "lucide-react"
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
import {
  ADDON_CATALOG,
  PHOTO_UPLOAD_POLICY,
  PLAN_COMPARISON,
  SERVICE_PACKAGE,
  getPlanPackage,
  type PlanComparisonValue,
} from "@/lib/plans-catalog"
import { PLAN_SEATS, TRIAL_INCLUDES_ADDONS, type PlanTier, type SalePlanTier } from "@/lib/plan"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { getDiscountedPlanPriceMinor } from "@/lib/billing/referral-discount"

type BillingCycle = "monthly" | "yearly"

const PACKAGE = SERVICE_PACKAGE

function planBillingCaption(cycle: BillingCycle): string {
  return `Atölye başına · ${cycle === "yearly" ? "yıllık" : "aylık"} faturalandırılır`
}

function ComparisonValue({ value, minimal = false }: { value: PlanComparisonValue; minimal?: boolean }) {
  if (minimal && (value.state === "included" || value.state === "unavailable")) {
    return (
      <span className="inline-flex items-center justify-center">
        {value.state === "included"
          ? <Check className="size-3.5 text-muted-foreground" strokeWidth={2.25} aria-hidden="true" />
          : <Minus className="size-3.5 text-muted-foreground" strokeWidth={2.25} aria-hidden="true" />}
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

/** "Pakete dahil olanlar" — semantik tablo (masaüstü + ayarlar). */
function IncludedTable({ label = "Pakete dahil olanlar" }: { label?: string }) {
  return (
    <Table aria-label={label} className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead scope="col" className="w-[62%] px-4 text-xs font-medium text-muted-foreground">Özellik ve limit</TableHead>
          <TableHead scope="col" className="px-4 text-center text-xs font-medium text-muted-foreground">{PACKAGE.name}</TableHead>
        </TableRow>
      </TableHeader>
      {PLAN_COMPARISON.map((category) => (
        <TableBody key={category.key}>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="rowgroup" colSpan={2} className="h-auto bg-muted/40 px-4 pb-1 pt-4 text-sm font-semibold leading-5 text-foreground">
              {category.label}
            </TableHead>
          </TableRow>
          {category.rows.map((row) => (
            <TableRow key={row.key} className="hover:bg-transparent">
              <TableHead scope="row" className="h-auto px-4 py-2 text-sm font-medium leading-5 whitespace-normal text-foreground">
                {row.label}
                {row.description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.description}</span>}
              </TableHead>
              <TableCell className="px-4 py-2 text-center text-sm whitespace-normal text-foreground">
                <ComparisonValue value={row.values[PACKAGE.tier]} minimal />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  )
}

/** Pakete dahil OLMAYAN ek özellikler — fiyat yok, satın alma akışı yakında. */
function AddonList({ headingId }: { headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">Pakete dahil olmayan ek özellikler</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          Uygulama içinden ayrıca alınır; satın alma yakında açılacak.
          {TRIAL_INCLUDES_ADDONS && " Deneme süresince ücretsiz deneyebilirsiniz."}
        </p>
      </div>
      <ul className="divide-y rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--border)]">
        {ADDON_CATALOG.map((addon) => (
          <li key={addon.key} className="flex items-start gap-3 px-4 py-3">
            <PlusCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{addon.name}</span>
                <Badge variant="secondary">Yakında</Badge>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{addon.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PlanAction({
  billing,
  checkoutBasePath,
  ownedTier,
  hasPendingOrder,
  canPurchase,
  onSelectPlan,
}: {
  billing: BillingCycle
  checkoutBasePath: string
  ownedTier: PlanTier | null
  hasPendingOrder: boolean
  canPurchase: boolean
  onSelectPlan?: (tier: SalePlanTier, cycle: BillingCycle) => void
}) {
  const isOwned = ownedTier === PACKAGE.tier
  const isRegistration = checkoutBasePath.startsWith("/register")

  if (!canPurchase) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Paket değişikliği için yöneticinizle görüşün.
      </p>
    )
  }
  if (hasPendingOrder) {
    return (
      <Button type="button" disabled variant="outline" className="w-full">
        Bekleyen talebiniz var
      </Button>
    )
  }

  // Yenileme ve dönem değişikliği "Paketi yönet" üzerinden yapılır; tek yol kalsın.
  if (isOwned) {
    return (
      <Button type="button" disabled variant="secondary" className="w-full">
        Mevcut paket
      </Button>
    )
  }

  const label = isRegistration ? "Ücretsiz dene" : "Paketi satın al"
  const trackSelection = () => trackMarketingEvent("purchase_started", {
    plan_tier: PACKAGE.tier,
    billing_cycle: billing,
    cta_location: "pricing_card",
  })
  if (onSelectPlan) {
    return (
      <Button
        type="button"
        variant="foreground"
        className="w-full"
        onClick={() => { trackSelection(); onSelectPlan(PACKAGE.tier, billing) }}
      >
        {label}
      </Button>
    )
  }
  return (
    <Button asChild variant="navy" className="w-full">
      <Link href={`${checkoutBasePath}?tier=${PACKAGE.tier}&cycle=${billing}`} onClick={trackSelection}>
        {label}
      </Link>
    </Button>
  )
}

export function PlanPackages({
  presentation = "public",
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/checkout",
  hasPendingOrder = false,
  canPurchase = true,
  onSelectPlan,
  onManagePlan,
  onRequestCycleChange,
  settingsChrome = true,
  currentCycle = null,
  isTrialing = false,
  trialDaysLeft = null,
  referralDiscountBps = 0,
}: {
  /** `public` = /fiyatlar marketing layout. `settings` = compact in-app layout. */
  presentation?: "public" | "settings"
  /** Persisted, active (paid) tier — `null` during a trial. */
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
  /** A pending-payment order already exists — block new requests until it's confirmed/cancelled. */
  hasPendingOrder?: boolean
  /** Billing viewers without billing.manage can compare, but cannot start checkout. */
  canPurchase?: boolean
  onSelectPlan?: (tier: SalePlanTier, cycle: BillingCycle) => void
  onManagePlan?: () => void
  /** “Aylığa geç” / “Yıllığa geç” opens the manage-plan dialog on that cycle. */
  onRequestCycleChange?: (cycle: BillingCycle) => void
  /** Settings page heading and current-plan card. */
  settingsChrome?: boolean
  currentCycle?: BillingCycle | null
  isTrialing?: boolean
  trialDaysLeft?: number | null
  referralDiscountBps?: number
}) {
  const isPublic = presentation === "public"
  const [billing, setBilling] = useState<BillingCycle>(currentCycle ?? (isPublic ? "monthly" : "yearly"))
  const supportHref = getSupportWhatsAppUrl(`Merhaba, BakımX Servis Paketi hakkında bilgi almak istiyorum.${workshopName ? ` (${workshopName})` : ""}`)

  if (!isPublic) {
    const currentPkg = isTrialing ? PACKAGE : ownedTier ? getPlanPackage(ownedTier) : undefined
    const stripCycle = currentCycle ?? "yearly"
    // Denemede seçilmiş bir dönem yoktur; dönem ifadesi ve geçiş eylemi yalnız
    // dönemi belli ücretli aboneliklerde gösterilir.
    const hasCommittedCycle = !isTrialing && currentCycle !== null
    const monthlyEquivalent = (tier: PlanTier, cycle: BillingCycle) => {
      const discounted = getDiscountedPlanPriceMinor(tier, cycle, referralDiscountBps) / 100
      return cycle === "monthly" ? discounted : Math.round(discounted / 12)
    }
    const packageAmount = monthlyEquivalent(PACKAGE.tier, billing)
    return (
      <section aria-label="Servis Paketi" className="min-w-0 space-y-4">
        {settingsChrome && (
          <>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-[-0.4px] text-foreground">Paket ve ek özellikler</h2>
              <p className="text-sm leading-5 text-muted-foreground">
                Servis yönetimi için gereken her şey tek pakette. Sorunuz varsa{" "}
                <a href={supportHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2">
                  bize yazın
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
                .
              </p>
            </div>

            {currentPkg && (
              <div className="rounded-xl bg-card px-3 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground">Mevcut</span>
                  {isTrialing && trialDaysLeft != null && (
                    <span className="text-xs font-medium text-muted-foreground">{trialDaysLeft} iş günü deneme</span>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                      <Hexagon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-lg font-semibold leading-6 tracking-[-0.2px] text-foreground">{currentPkg.name}</p>
                        {isTrialing && (
                          <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-1.5 text-xs font-medium text-primary-strong">
                            {TRIAL_INCLUDES_ADDONS ? "Deneme · ek özellikler dahil" : "Deneme"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium leading-4 text-muted-foreground">
                        ₺{monthlyEquivalent(currentPkg.tier, stripCycle).toLocaleString("tr-TR")} / ay
                        {hasCommittedCycle && (stripCycle === "yearly" ? " · yıllık faturalandırılır" : " · aylık faturalandırılır")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    {onManagePlan && (
                      <Button type="button" variant="outline" className="shrink-0" onClick={onManagePlan}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Paketi yönet
                      </Button>
                    )}
                    {hasCommittedCycle && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="shrink-0 text-primary"
                        onClick={() => {
                          const next = stripCycle === "yearly" ? "monthly" : "yearly"
                          if (onRequestCycleChange) onRequestCycleChange(next)
                          else setBilling(next)
                        }}
                      >
                        {stripCycle === "yearly" ? "Aylığa geç" : "Yıllığa geç"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-xl bg-card p-4 shadow-[inset_0_0_0_1px_var(--border)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-foreground">{PACKAGE.name}</p>
                  <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{PACKAGE.tagline}</p>
                </div>
                <BillingCycleToggle value={billing} onChange={setBilling} yearlyHint="%17" yearlyHintSrSuffix=" indirim" />
              </div>
              <p className="mt-3 text-[24px] font-semibold leading-7 tracking-[-0.48px] text-foreground">
                ₺{packageAmount.toLocaleString("tr-TR")}
                <span className="ml-0.5 text-xs font-medium leading-4 tracking-normal text-muted-foreground">/ay</span>
              </p>
              <p className="mt-1 text-xs font-medium leading-4 text-muted-foreground">
                {planBillingCaption(billing)} · KDV dahil
                {referralDiscountBps > 0 && <> · İlk yıl %10 indirim</>}
              </p>
              <div className="mt-4">
                <PlanAction
                  billing={billing}
                  checkoutBasePath={checkoutBasePath}
                  ownedTier={ownedTier}
                  hasPendingOrder={hasPendingOrder}
                  canPurchase={canPurchase}
                  onSelectPlan={onSelectPlan}
                />
              </div>
            </div>
            <AddonList headingId="ayarlar-ek-ozellikler" />
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--border)]">
            <IncludedTable />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Servis Paketi" className="space-y-5">
      <div className="flex justify-center pt-2">
        <BillingCycleToggle value={billing} onChange={setBilling} yearlyHint="%17" yearlyHintSrSuffix=" indirim" />
      </div>
      <div className="mx-auto grid max-w-4xl gap-6 !mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          role="article"
          aria-labelledby={`paket-${PACKAGE.tier}`}
          className="relative h-full gap-0 rounded-xl border border-border/70 p-6 shadow-sm ring-0"
        >
          <h3 id={`paket-${PACKAGE.tier}`} className="text-xl font-medium tracking-tight">{PACKAGE.name}</h3>
          <div className="mt-7" aria-live="polite" aria-atomic="true">
            <div className="flex min-h-12 flex-wrap items-center gap-3">
              <p className="flex items-baseline text-[40px] font-semibold leading-[48px] tracking-[-0.025em]">
                <span>₺</span>
                <PriceRoll
                  monthly={PACKAGE.monthlyPrice.toLocaleString("tr-TR")}
                  yearly={PACKAGE.yearlyPrice.toLocaleString("tr-TR")}
                  cycle={billing}
                />
              </p>
              {billing === "yearly" && <Badge variant="outline" className="rounded-sm border-border bg-muted font-normal text-foreground">2 ay bedava</Badge>}
            </div>
            <p className="min-h-5 text-xs leading-5 text-muted-foreground">{planBillingCaption(billing)} · KDV dahil</p>
          </div>
          <p className="mt-8 text-sm font-medium leading-5">{PACKAGE.tagline}</p>
          <ul className="mb-8 mt-2.5 space-y-2.5">
            {PACKAGE.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 rounded-[5px] bg-muted text-muted-foreground" aria-hidden="true" />
                {highlight}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 rounded-[5px] bg-muted text-muted-foreground" aria-hidden="true" />
              {PACKAGE.seats} kullanıcı dahil
            </li>
          </ul>
          <div className="mt-auto">
            <PlanAction billing={billing} checkoutBasePath={checkoutBasePath} ownedTier={ownedTier} hasPendingOrder={hasPendingOrder} canPurchase={canPurchase} onSelectPlan={onSelectPlan} />
          </div>
        </Card>
        <div className="hidden lg:block">
          <AddonList headingId="fiyat-ek-ozellikler" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl !mt-12 space-y-3 text-center text-xs leading-5 text-muted-foreground">
        <p>Kart bilgisi olmadan 7 iş günü ücretsiz deneme. Yıllık ödemede 2 ay bedava. Tüm fiyatlara KDV dahildir.</p>
        <p>
          Pakette {PLAN_SEATS.pro} kullanıcı vardır; daha fazlası için bizimle iletişime geçin. Deneme otomatik ücretliye
          dönüşmez, paketi kendi onayınızla etkinleştirirsiniz.
        </p>
      </div>
      <div className="pb-6 pt-16 text-center sm:pt-24">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pakete neler dahil?</h2>
        <p className="mt-3 text-sm text-muted-foreground">Servis yönetimi için gereken özellikler ve kullanım limitleri.</p>
      </div>

      <div className="mx-auto hidden max-w-4xl lg:block">
        <IncludedTable />
      </div>

      <Tabs defaultValue="included" className="lg:hidden">
        <TabsList size="control" className="grid w-full grid-cols-2 border-b bg-card">
          <TabsTrigger value="included">Pakete dahil</TabsTrigger>
          <TabsTrigger value="addons">Ek özellikler</TabsTrigger>
        </TabsList>
        <TabsContent value="included" className="space-y-4 rounded-xl border bg-card p-4">
          {PLAN_COMPARISON.map((category) => (
            <section key={category.key} aria-labelledby={`mobil-${category.key}`} className="space-y-2">
              <h3 id={`mobil-${category.key}`} className="border-b pb-2 text-sm font-semibold text-foreground">
                {category.label}
              </h3>
              <dl className="divide-y">
                {category.rows.map((row) => (
                  <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
                    <dt className="min-w-0 text-sm text-foreground">
                      {row.label}
                      {row.description && <span className="mt-0.5 block text-xs text-muted-foreground">{row.description}</span>}
                    </dt>
                    <dd className="text-right text-sm font-medium"><ComparisonValue value={row.values[PACKAGE.tier]} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </TabsContent>
        <TabsContent value="addons">
          <AddonList headingId="mobil-ek-ozellikler" />
        </TabsContent>
      </Tabs>

      <div className="mx-auto max-w-4xl rounded-lg border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">Fotoğraf yükleme kuralları</p>
        <p>
          Tek seçimde en fazla {PHOTO_UPLOAD_POLICY.maxPerSelection} fotoğraf ve fotoğraf başına en fazla{" "}
          {PHOTO_UPLOAD_POLICY.rawSelectionMb} MB ham dosya seçilebilir. İstemci yaklaşık{" "}
          {PHOTO_UPLOAD_POLICY.compressionTargetMb} MB hedefiyle sıkıştırır; sunucu sınırı{" "}
          {PHOTO_UPLOAD_POLICY.serverLimitMb} MB’dir.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sorunuz mu var?{" "}
        <a
          href={supportHref}
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
