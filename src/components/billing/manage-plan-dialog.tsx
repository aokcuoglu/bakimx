"use client"

import { useState } from "react"
import { ArrowLeft, CalendarRange, Check, CreditCard, Gauge, Hexagon, Minus, Plus, Users, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMinor } from "@/lib/billing/pricing"
import { getDiscountedPlanPriceMinor } from "@/lib/billing/referral-discount"
import { getSeatLimit, VIN_LOOKUP_QUOTA, type SalePlanTier } from "@/lib/plan"
import { isPlanDowngrade, isPlanUpgrade } from "@/lib/billing/plan-change"
import { PLAN_PACKAGES, getPlanPackage } from "@/lib/plans-catalog"
import { PlanPackages } from "@/components/billing/plan-packages"
import { cn } from "@/lib/utils"

type Cycle = "monthly" | "yearly"
type Method = "card" | "havale"

const QUOTA_PACKS = [
  { amount: 0, priceMinor: 0, label: "Ek kota yok" },
  { amount: 1_000, priceMinor: 19_900, label: "+1.000 sorgu/ay" },
  { amount: 3_000, priceMinor: 49_900, label: "+3.000 sorgu/ay" },
  { amount: 5_000, priceMinor: 79_900, label: "+5.000 sorgu/ay" },
  { amount: 10_000, priceMinor: 149_900, label: "+10.000 sorgu/ay" },
] as const

export type ManagePlanDraft = {
  cycle: Cycle
  method: Method
  invoiceTitle: string
  taxNumber: string
  taxOffice: string
}

export function ManagePlanDialog({
  open,
  onOpenChange,
  planName,
  planTier,
  currentCycle,
  currentPeriodEnd,
  canPurchase,
  hasPendingOrder,
  pendingActions,
  onChangePlan,
  onSelectPlan,
  onDowngrade,
  onConfirm,
  preferredCycle = null,
  isTrialing = false,
  seatUsed = 0,
  extraSeats = 0,
  defaultInvoiceTitle = "",
  defaultTaxNumber = "",
  defaultTaxOffice = "",
  referralDiscountBps = 0,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planName: string
  planTier: SalePlanTier | null
  currentCycle: Cycle | null
  currentPeriodEnd: Date | string | null
  canPurchase: boolean
  hasPendingOrder: boolean
  pendingActions?: React.ReactNode
  onChangePlan: () => void
  /** Picks a different tier from the in-dialog upgrade cards. */
  onSelectPlan?: (tier: SalePlanTier, cycle: Cycle) => void
  onDowngrade?: (tier: SalePlanTier) => void
  onConfirm: (draft: ManagePlanDraft) => void
  preferredCycle?: Cycle | null
  isTrialing?: boolean
  seatUsed?: number
  extraSeats?: number
  defaultInvoiceTitle?: string
  defaultTaxNumber?: string
  defaultTaxOffice?: string
  referralDiscountBps?: number
}) {
  const baseline = currentCycle ?? "yearly"
  const [cycle, setCycle] = useState<Cycle>(preferredCycle ?? baseline)
  const [method, setMethod] = useState<Method>("card")
  const [invoiceTitle, setInvoiceTitle] = useState(defaultInvoiceTitle)
  const [taxNumber, setTaxNumber] = useState(defaultTaxNumber)
  const [taxOffice, setTaxOffice] = useState(defaultTaxOffice)
  const [addedSeats, setAddedSeats] = useState(extraSeats)
  const [quotaAmount, setQuotaAmount] = useState("0")
  const [error, setError] = useState("")
  const [picker, setPicker] = useState(false)
  const [pickerCycle, setPickerCycle] = useState<Cycle>(preferredCycle ?? baseline)

  const includedSeats = planTier ? getSeatLimit(planTier, 0) : 1
  const seatTotal = includedSeats + addedSeats
  const includedQuota = planTier ? VIN_LOOKUP_QUOTA[planTier] : 0
  const quotaPack = QUOTA_PACKS.find((pack) => String(pack.amount) === quotaAmount) ?? QUOTA_PACKS[0]
  const planAmount = planTier != null ? getDiscountedPlanPriceMinor(planTier, cycle, referralDiscountBps) : 0
  const total = planAmount
  const periodEnd =
    currentPeriodEnd != null
      ? new Date(currentPeriodEnd).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
      : null
  const pkg = planTier ? getPlanPackage(planTier) : null
  const locked = !canPurchase || hasPendingOrder
  const dirty = cycle !== baseline || quotaPack.amount > 0 || addedSeats !== extraSeats
  const perMonth = (option: Cycle) => {
    const optionAmount = planTier ? getDiscountedPlanPriceMinor(planTier, option, referralDiscountBps) : 0
    return option === "yearly" ? Math.round(optionAmount / 12) : optionAmount
  }

  function confirm() {
    if (invoiceTitle.trim().length < 2) {
      setError("Fatura ünvanı zorunludur.")
      return
    }
    if (taxNumber.trim().length < 10) {
      setError("Vergi/TC kimlik no en az 10 hane olmalıdır.")
      return
    }
    setError("")
    onConfirm({
      cycle,
      method,
      invoiceTitle: invoiceTitle.trim(),
      taxNumber: taxNumber.trim(),
      taxOffice: taxOffice.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(92dvh,880px)] max-h-[min(92dvh,880px)] !w-[min(808px,calc(100%-1.5rem))] !max-w-[808px] flex-col gap-0 overflow-hidden rounded-[var(--radius-dialog)] bg-card p-0 sm:!max-w-[808px]",
        )}
        overlayClassName="bg-foreground/25"
        showCloseButton={false}
      >
        <DialogHeader className="min-h-11 justify-center border-b px-4 py-2 pr-12">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            {picker && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Geri" onClick={() => setPicker(false)}>
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {picker ? "Paketi yükselt" : "Paketi yönet"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Mevcut plan, faturalama dönemi, koltuk, katalog kotası ve ödeme bilgisi.
          </DialogDescription>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-3 text-muted-foreground">
              <X className="size-4" />
              <span className="sr-only">Kapat</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        {!picker && <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Mevcut plan</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight">{pkg ? `${pkg.name} paketini yönet` : planName}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPurchase}
            onClick={() => {
              if (onSelectPlan) setPicker(true)
              else onChangePlan()
            }}
          >
            Değiştir
          </Button>
        </div>}

        {picker ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="flex justify-center">
              <ToggleGroup
                type="single"
                value={pickerCycle}
                onValueChange={(value) => { if (value) setPickerCycle(value as Cycle) }}
                className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
                aria-label="Faturalama dönemi"
              >
                {(["yearly", "monthly"] as const).map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="h-7! min-w-0 rounded-lg px-2 text-sm font-medium text-muted-foreground data-[state=on]:!bg-card data-[state=on]:!text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border)]"
                  >
                    {option === "yearly" ? "Yıllık" : "Aylık"}
                    {option === "yearly" && <span className="rounded-md bg-primary/10 px-1 text-[11px] font-medium text-primary-strong">-17%</span>}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLAN_PACKAGES.filter((pkg) => pkg.tier !== "lite").map((pkg) => {
                const owned = planTier === pkg.tier
                const downgrade = isPlanDowngrade(planTier, pkg.tier)
                const upgrade = isPlanUpgrade(planTier, pkg.tier)
                const discountedPrice = getDiscountedPlanPriceMinor(pkg.tier, pickerCycle, referralDiscountBps) / 100
                const perMonth = pickerCycle === "yearly" ? Math.round(discountedPrice / 12) : discountedPrice
                return (
                  <article key={pkg.tier} className="rounded-xl border bg-card p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-primary">
                      <Hexagon className="size-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-lg font-semibold">{pkg.name}</h3>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">₺{perMonth.toLocaleString("tr-TR")}</p>
                    {referralDiscountBps > 0 && pkg.tier !== "lite" && <p className="text-xs text-muted-foreground">İlk yıl %10 referans indirimi</p>}
                    <p className="text-xs text-muted-foreground">Atölye başına · {pickerCycle === "yearly" ? "aylık karşılık, yıllık faturalandırılır" : "aylık faturalandırılır"}</p>
                    <Button
                      type="button"
                      variant={owned ? "secondary" : pkg.popular && upgrade ? "navy" : "outline"}
                      className="mt-4 w-full"
                      disabled={owned || !canPurchase || hasPendingOrder}
                      onClick={() => {
                        if (downgrade) onDowngrade?.(pkg.tier)
                        else onSelectPlan?.(pkg.tier, pickerCycle)
                      }}
                    >
                      {owned ? "Mevcut paket" : downgrade ? `${pkg.name} paketine düş` : upgrade || planTier == null ? "Yükselt" : "Bu paketi seç"}
                    </Button>
                    <p className="mt-4 text-sm font-medium">{pkg.tagline}</p>
                    <ul className="mt-2 space-y-1.5">
                      {pkg.highlights.slice(0, 3).map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
            {PLAN_PACKAGES.filter((pkg) => pkg.tier === "lite").map((pkg) => {
              const owned = planTier === pkg.tier
              const downgrade = isPlanDowngrade(planTier, pkg.tier)
              return (
                <article key={pkg.tier} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                      <Hexagon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold">{pkg.name}</h3>
                      <p className="text-sm text-muted-foreground">{pkg.tagline}</p>
                      <ul className="mt-2 space-y-1">
                        {pkg.highlights.slice(0, 3).map((highlight) => (
                          <li key={highlight} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={owned || !canPurchase || hasPendingOrder}
                    onClick={() => {
                      if (downgrade) onDowngrade?.(pkg.tier)
                      else onSelectPlan?.(pkg.tier, pickerCycle)
                    }}
                  >
                    {owned ? "Mevcut paket" : "Lite paketine düş"}
                  </Button>
                </article>
              )
            })}
            <PlanPackages
              referralDiscountBps={referralDiscountBps}
              key={pickerCycle}
              presentation="settings"
              settingsChrome={false}
              ownedTier={planTier}
              currentCycle={pickerCycle}
              canPurchase={canPurchase}
              hasPendingOrder={hasPendingOrder}
              onSelectPlan={onSelectPlan}
              onDowngrade={onDowngrade}
            />
          </div>
        ) : (
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-hidden">
          <div className="min-w-0 space-y-6 border-b px-4 py-4 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {hasPendingOrder && (
              <Alert variant="warning">
                <AlertDescription className="space-y-2">
                  <p>Bekleyen bir paket talebiniz var. Yeni paket seçmek için önce bu talebi tamamlayın veya iptal edin.</p>
                  {pendingActions}
                </AlertDescription>
              </Alert>
            )}
            {!canPurchase && (
              <Alert>
                <AlertDescription>Paket değişikliği için yöneticinizle görüşün.</AlertDescription>
              </Alert>
            )}

            <section className="space-y-2">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Faturalama dönemi
              </h3>
              <ToggleGroup
                type="single"
                orientation="vertical"
                value={cycle}
                onValueChange={(value) => { if (value) setCycle(value as Cycle) }}
                className="flex w-full flex-col gap-2"
                aria-label="Faturalama dönemi"
                disabled={locked}
              >
                {(["yearly", "monthly"] as const).map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="h-auto w-full justify-between gap-3 rounded-xl border bg-card px-2.5 py-2 text-left font-normal whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:ring-2 data-[state=on]:ring-primary/10"
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-4 rounded-full border", cycle === option ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--card)]" : "border-input")} aria-hidden="true" />
                      {option === "yearly" ? "Yıllık (2 ay bedava)" : "Aylık"}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {perMonth(option) > 0 ? `${formatMinor(perMonth(option))} / ay` : "₺0 / ay"}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </section>

            <section className="space-y-2 border-t pt-5">
              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Koltuk
                <span className="font-normal text-muted-foreground">{includedSeats} dahil, {seatUsed} kullanılıyor</span>
              </h3>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon-sm" aria-label="Koltuk azalt" disabled={locked || addedSeats <= 0 || seatTotal <= seatUsed} onClick={() => setAddedSeats((count) => Math.max(0, count - 1))}>
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center text-sm font-medium" aria-live="polite">{seatTotal}</span>
                <Button type="button" variant="outline" size="icon-sm" aria-label="Koltuk artır" disabled={locked} onClick={() => setAddedSeats((count) => count + 1)}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </section>

            <section className="space-y-2 border-t pt-5">
              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Katalog kotası
                <span className="font-normal text-muted-foreground">{includedQuota.toLocaleString("tr-TR")} dahil</span>
              </h3>
              <Select value={quotaAmount} onValueChange={setQuotaAmount} disabled={locked}>
                <SelectTrigger className="w-full" aria-label="Ek katalog kotası">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTA_PACKS.map((pack) => (
                    <SelectItem key={pack.amount} value={String(pack.amount)}>
                      {pack.label}{pack.priceMinor > 0 ? ` · ${formatMinor(pack.priceMinor)} / ay` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-3 border-t pt-5">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
                Ödeme bilgisi
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="manage-invoice-title">Fatura ünvanı</Label>
                <Input id="manage-invoice-title" value={invoiceTitle} onChange={(event) => setInvoiceTitle(event.target.value)} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-tax-number">Vergi / TC kimlik no</Label>
                <Input id="manage-tax-number" value={taxNumber} onChange={(event) => setTaxNumber(event.target.value)} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-tax-office">Vergi dairesi</Label>
                <Input id="manage-tax-office" value={taxOffice} onChange={(event) => setTaxOffice(event.target.value)} disabled={locked} />
              </div>
              <ToggleGroup
                type="single"
                value={method}
                onValueChange={(value) => { if (value) setMethod(value as Method) }}
                className="grid w-full grid-cols-2 gap-2"
                aria-label="Ödeme yöntemi"
                disabled={locked}
              >
                <ToggleGroupItem value="card" className="h-7 rounded-[8px] border data-[state=on]:border-primary data-[state=on]:bg-primary/5">Kart</ToggleGroupItem>
                <ToggleGroupItem value="havale" className="h-7 rounded-[8px] border data-[state=on]:border-primary data-[state=on]:bg-primary/5">Havale/EFT</ToggleGroupItem>
              </ToggleGroup>
            </section>
          </div>

          <div className="min-w-0 space-y-4 bg-muted/20 px-4 py-4 lg:overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Ödeme özeti</p>
              <p className="text-xs text-muted-foreground">{cycle === "yearly" ? "Yıllık" : "Aylık"}</p>
            </div>
            {isTrialing && periodEnd && (
              <Alert variant="info">
                <AlertDescription>Deneme bitene kadar ({periodEnd}) kartınız çekilmez.</AlertDescription>
              </Alert>
            )}
            {!isTrialing && periodEnd && cycle !== baseline && (
              <Alert>
                <AlertDescription>Dönem değişikliği {periodEnd} tarihindeki yenilemede uygulanır. Ara dönemde iade yapılmaz.</AlertDescription>
              </Alert>
            )}
            <dl className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="min-w-0 text-muted-foreground">{seatTotal} koltuk</dt>
                <dd>{planAmount > 0 ? formatMinor(planAmount) : "₺0"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="min-w-0 text-muted-foreground">{(includedQuota + quotaPack.amount).toLocaleString("tr-TR")} katalog sorgusu</dt>
                <dd>{quotaPack.priceMinor > 0 ? formatMinor(quotaPack.priceMinor) : "Dahil"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t pt-3">
                <dt className="font-medium">Yenilemede toplam</dt>
                <dd className="text-lg font-semibold">{formatMinor(total)}</dd>
              </div>
            </dl>
            {error && <p className="text-sm text-destructive-strong" role="alert">{error}</p>}
            <Button type="button" variant="foreground" className="w-full" disabled={locked || !dirty} onClick={confirm}>
              Onayla
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              {method === "card"
                ? "Onaydan sonra kart ödemesi 3D Secure ile açılır."
                : "Onaydan sonra Havale/EFT bilgileri gösterilir."}
              {quotaPack.amount > 0 ? " Ek katalog kotası özet satırında durur; yenileme tutarı paket bedelidir." : ""}
            </p>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
