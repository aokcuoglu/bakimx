"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarRange, CreditCard, MessageCircle, Users, X } from "lucide-react"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatMinor } from "@/lib/billing/pricing"
import { getDiscountedPlanPriceMinor } from "@/lib/billing/referral-discount"
import { getSeatLimit, type SalePlanTier } from "@/lib/plan"
import { SERVICE_PACKAGE } from "@/lib/plans-catalog"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"

type Cycle = "monthly" | "yearly"
type Method = "card" | "havale"

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
  /** Owned (active, paid) sale tier — `null` during a trial or on a legacy row. */
  planTier: SalePlanTier | null
  currentCycle: Cycle | null
  currentPeriodEnd: Date | string | null
  canPurchase: boolean
  hasPendingOrder: boolean
  pendingActions?: React.ReactNode
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
  const [error, setError] = useState("")

  // Satışta tek paket var (#782): sahip olunan paket ne olursa olsun yenileme /
  // satın alma Servis Paketi üzerinden fiyatlanır.
  const pkg = SERVICE_PACKAGE
  const seatTotal = getSeatLimit(pkg.tier, extraSeats)
  const planAmount = getDiscountedPlanPriceMinor(pkg.tier, cycle, referralDiscountBps)
  const total = planAmount
  const periodEnd =
    currentPeriodEnd != null
      ? new Date(currentPeriodEnd).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
      : null
  const locked = !canPurchase || hasPendingOrder
  // Paketi henüz satın almamış atölye (deneme / eski satır) varsayılan dönemi de onaylayabilir.
  const dirty = planTier == null || cycle !== baseline
  const perMonth = (option: Cycle) => {
    const optionAmount = getDiscountedPlanPriceMinor(pkg.tier, option, referralDiscountBps)
    return option === "yearly" ? Math.round(optionAmount / 12) : optionAmount
  }
  const seatContactHref = getSupportWhatsAppUrl(`Merhaba, BakımX hesabımıza ek kullanıcı eklemek istiyoruz. (${planName})`)

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
            Paketi yönet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Mevcut paket, faturalama dönemi, kullanıcı sayısı ve ödeme bilgisi.
          </DialogDescription>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-3 text-muted-foreground">
              <X className="size-4" />
              <span className="sr-only">Kapat</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Mevcut paket</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight">{planTier ? pkg.name : planName}</p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-hidden">
          <div className="min-w-0 space-y-6 border-b px-4 py-4 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {hasPendingOrder && (
              <Alert variant="warning">
                <AlertDescription className="space-y-2">
                  <p>Bekleyen bir paket talebiniz var. Yeni sipariş için önce bu talebi tamamlayın veya iptal edin.</p>
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
                      {formatMinor(perMonth(option))} / ay
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </section>

            <section className="space-y-2 border-t pt-5">
              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Kullanıcı
                <span className="font-normal text-muted-foreground">{seatTotal} dahil, {seatUsed} kullanılıyor</span>
              </h3>
              <p className="text-xs leading-5 text-muted-foreground">
                {pkg.name} {pkg.seats} kullanıcı içerir. Daha fazlası için bizimle iletişime geçin.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={seatContactHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Ek kullanıcı için iletişim
                </Link>
              </Button>
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
                <dt className="min-w-0 text-muted-foreground">{pkg.name} · {seatTotal} kullanıcı</dt>
                <dd>{formatMinor(planAmount)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t pt-3">
                <dt className="font-medium">{planTier ? "Yenilemede toplam" : "Toplam"}</dt>
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
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
