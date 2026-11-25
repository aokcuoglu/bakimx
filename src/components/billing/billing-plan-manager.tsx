"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { AlertTriangle, CheckCircle2, CreditCard, Landmark, Package, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PlanPackages } from "@/components/billing/plan-packages"
import { ManagePlanDialog } from "@/components/billing/manage-plan-dialog"
import { BillingUsagePanel } from "@/components/billing/billing-usage-panel"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import { CancelPendingOrderButton } from "@/components/billing/pending-order-actions"
import { createBillingOrder } from "@/app/(app)/billing/actions"
import { DOWNGRADE_BLOCKED_MESSAGE, isDowngradeBlocked } from "@/lib/billing/plan-change"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import { getDiscountedPlanPriceMinor } from "@/lib/billing/referral-discount"
import type { HavaleInfo } from "@/lib/billing/provider"
import { getSeatLimit, isSalePlanTier, type PlanState, type PlanTier, type SalePlanTier } from "@/lib/plan"
import type { WorkshopQuotaUsage } from "@/lib/rapidapi-quota"
import { getPlanPackage } from "@/lib/plans-catalog"
import { TRIAL_PLAN_NAME } from "@/lib/billing/sidebar-plan-status"
import { typedResolver } from "@/lib/validations/resolver"
import { checkoutInAppSchema, type CheckoutInAppValues } from "@/lib/validations/billing"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"

type Cycle = "monthly" | "yearly"
type PaymentResult = { reference: string; amountMinor: number; method: "card" | "havale" }

export function BillingPlanManager({
  ownedTier,
  currentPlanName,
  currentCycle,
  isTrialing,
  trialDaysLeft,
  workshopName,
  hasPendingOrder,
  pendingReference,
  pendingMethod,
  pendingAmountMinor,
  pendingPlanTier,
  pendingCycle,
  canPurchase,
  defaultInvoiceTitle,
  defaultTaxNumber,
  defaultTaxOffice,
  seatUsage,
  extraSeats,
  havale,
  currentPeriodEnd = null,
  showComparison = true,
  explorePlansHref,
  referralDiscountBps = 0,
  usage,
}: {
  ownedTier: PlanTier | null
  currentPlanName: string
  currentCycle: Cycle | null
  isTrialing: boolean
  trialDaysLeft: number | null
  workshopName: string
  hasPendingOrder: boolean
  pendingReference?: string
  pendingMethod?: string
  pendingAmountMinor?: number
  pendingPlanTier?: PlanTier
  pendingCycle?: Cycle
  canPurchase: boolean
  defaultInvoiceTitle: string
  defaultTaxNumber: string
  defaultTaxOffice: string
  seatUsage: { activeUsers: number; pendingInvites: number; used: number }
  extraSeats: number
  havale: HavaleInfo
  currentPeriodEnd?: Date | string | null
  showComparison?: boolean
  explorePlansHref?: string
  referralDiscountBps?: number
  usage?: { plan: PlanState; quota: WorkshopQuotaUsage }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [pendingPaymentOpen, setPendingPaymentOpen] = useState(false)
  const [managePreferredCycle, setManagePreferredCycle] = useState<Cycle | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<PaymentResult | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const saleOwned = ownedTier && isSalePlanTier(ownedTier) ? ownedTier : null
  const initialTier = saleOwned ?? "pro"
  const form = useForm<CheckoutInAppValues, unknown, CheckoutInAppValues>({
    resolver: typedResolver<CheckoutInAppValues>(checkoutInAppSchema),
    defaultValues: {
      tier: initialTier,
      cycle: currentCycle ?? "monthly",
      method: "card",
      invoiceTitle: defaultInvoiceTitle,
      taxNumber: defaultTaxNumber,
      taxOffice: defaultTaxOffice,
    },
  })
  const tier = useWatch({ control: form.control, name: "tier" })
  const cycle = useWatch({ control: form.control, name: "cycle" })
  const method = useWatch({ control: form.control, name: "method" })
  const pkg = getPlanPackage(tier)
  const catalogAmount = getPlanPriceMinor(tier, cycle)
  const discountedAmount = getDiscountedPlanPriceMinor(tier, cycle, referralDiscountBps)
  const excessSeats = Math.max(0, seatUsage.used - getSeatLimit(tier, extraSeats))
  const periodLabel = cycle === "yearly" ? "yıllık" : "aylık"

  // Sunucu kuralıyla aynı: engel yalnız ödenmiş dönem açıkken (createBillingOrder).
  const downgradeBlocked = (targetTier: SalePlanTier) =>
    isDowngradeBlocked({ subscriptionStatus: null, planTier: ownedTier, currentPeriodEnd, targetTier })

  function choosePlan(nextTier: SalePlanTier, nextCycle: Cycle) {
    setManageOpen(false)
    if (!open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      setDone(null)
    }
    form.setValue("tier", nextTier)
    form.setValue("cycle", nextCycle)
    // Satışta tek paket var; açık "Paket + ek özellikler" dönemi içinde Servis
    // Paketi'ne geçiş düşüştür ve sunucu da reddeder — kullanıcı nedenini önceden görsün.
    setError(downgradeBlocked(nextTier) ? DOWNGRADE_BLOCKED_MESSAGE : "")
    setOpen(true)
  }

  function openManage(preferred?: Cycle) {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setManagePreferredCycle(preferred ?? null)
    setManageOpen(true)
  }

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setDone(null)
      setError("")
    } else if (done) {
      router.refresh()
    }
  }

  async function submit(values: CheckoutInAppValues) {
    if (loading || hasPendingOrder || !canPurchase) return
    if (downgradeBlocked(values.tier)) {
      setError(DOWNGRADE_BLOCKED_MESSAGE)
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await createBillingOrder(values)
      if (result.ok) {
        trackMarketingEvent("purchase_submitted", { plan_tier: values.tier, billing_cycle: values.cycle, payment_method: result.method })
        setDone(result)
      } else setError(result.error)
    } catch {
      setError("Sipariş oluşturulamadı. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!showComparison && (
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-primary"><Package className="size-5" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-base font-semibold">{currentPlanName}</h2>
                {isTrialing && <Badge variant="outline">Deneme</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {isTrialing ? `${trialDaysLeft ?? 0} iş günü kaldı` : currentCycle === "yearly" ? "Yıllık faturalandırma" : currentCycle === "monthly" ? "Aylık faturalandırma" : "Etkin paket"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {explorePlansHref && <Button asChild variant="outline" size="sm"><Link href={explorePlansHref}>Paketleri incele</Link></Button>}
            {saleOwned && canPurchase && <Button type="button" variant="outline" size="sm" onClick={() => openManage()}>Paketi yönet</Button>}
          </div>
        </div>
      )}
      {showComparison && explorePlansHref && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm"><Link href={explorePlansHref}>Paketleri incele</Link></Button>
        </div>
      )}

      {showComparison && (
        <div id="paketler" className="scroll-mt-24">
          <PlanPackages
            presentation="settings"
            ownedTier={ownedTier}
            workshopName={workshopName}
            hasPendingOrder={hasPendingOrder}
            canPurchase={canPurchase}
            currentCycle={currentCycle}
            isTrialing={isTrialing}
            trialDaysLeft={trialDaysLeft}
            referralDiscountBps={referralDiscountBps}
            onSelectPlan={choosePlan}
            onManagePlan={() => openManage()}
            onRequestCycleChange={(next) => openManage(next)}
          />
        </div>
      )}

      {usage && (
        <BillingUsagePanel
          plan={usage.plan}
          seatUsage={seatUsage}
          extraSeats={extraSeats}
          quota={usage.quota}
          canPurchase={canPurchase}
          onManageSeats={() => openManage()}
        />
      )}

      {manageOpen && (
        <ManagePlanDialog
          key={`${saleOwned ?? "none"}-${currentCycle ?? "monthly"}-${managePreferredCycle ?? "current"}`}
          open={manageOpen}
          onOpenChange={setManageOpen}
          planName={isTrialing ? TRIAL_PLAN_NAME : currentPlanName}
          planTier={saleOwned}
          currentCycle={currentCycle}
          currentPeriodEnd={currentPeriodEnd}
          canPurchase={canPurchase}
          hasPendingOrder={hasPendingOrder}
          pendingActions={hasPendingOrder && pendingReference && canPurchase ? (
            <div className="flex flex-wrap items-center gap-2">
              {pendingMethod === "card" && <>
                <Button type="button" variant="navy" size="sm" onClick={() => { setManageOpen(false); setPendingPaymentOpen(true) }}>Ödemeye devam et</Button>
                <CancelPendingOrderButton reference={pendingReference} />
              </>}
              {pendingMethod !== "card" && <Button asChild variant="outline" size="sm"><Link href={getSupportWhatsAppUrl(`Merhaba, ${pendingReference} numaralı havale talebimi iptal etmek istiyorum.`)} target="_blank" rel="noopener noreferrer">İptal için destek</Link></Button>}
            </div>
          ) : undefined}
          preferredCycle={managePreferredCycle}
          isTrialing={isTrialing}
          seatUsed={seatUsage.used}
          extraSeats={extraSeats}
          defaultInvoiceTitle={defaultInvoiceTitle}
          defaultTaxNumber={defaultTaxNumber}
          defaultTaxOffice={defaultTaxOffice}
          referralDiscountBps={referralDiscountBps}
          onConfirm={(draft) => {
            const nextTier = saleOwned ?? "pro"
            form.setValue("tier", nextTier)
            form.setValue("cycle", draft.cycle)
            form.setValue("method", draft.method)
            form.setValue("invoiceTitle", draft.invoiceTitle)
            form.setValue("taxNumber", draft.taxNumber)
            form.setValue("taxOffice", draft.taxOffice)
            setManageOpen(false)
            setDone(null)
            setError("")
            setOpen(true)
            void submit({
              tier: nextTier,
              cycle: draft.cycle,
              method: draft.method,
              invoiceTitle: draft.invoiceTitle,
              taxNumber: draft.taxNumber,
              taxOffice: draft.taxOffice,
            })
          }}
        />
      )}

      {pendingMethod === "card" && pendingReference && pendingAmountMinor != null && (
        <Dialog open={pendingPaymentOpen} onOpenChange={setPendingPaymentOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
            <DialogHeader className="px-4 py-3 sm:px-5">
              <DialogTitle>Ödemeyi tamamla</DialogTitle>
              <DialogDescription>Bekleyen kart ödemenizin bilgilerini girin.</DialogDescription>
            </DialogHeader>
            <CardPaymentPanel reference={pendingReference} amountMinor={pendingAmountMinor} planLabel={`${pendingPlanTier ? getPlanPackage(pendingPlanTier)?.name ?? pendingPlanTier : "Paket"} · ${pendingCycle === "yearly" ? "Yıllık" : "Aylık"}`} presentation="attio" />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="flex max-h-[min(92dvh,900px)] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 sm:max-w-5xl" showCloseButton={false} onOpenAutoFocus={(event) => { event.preventDefault(); closeButtonRef.current?.focus() }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus() }}>
          <DialogHeader className="shrink-0 border-b bg-card px-5 py-4 pr-14 sm:px-7">
            <DialogTitle>{done ? "Siparişiniz" : "Ödemeyi tamamla"}</DialogTitle>
            <DialogDescription>
              {done ? "Sipariş tutarı ve sonraki adımlar aşağıda." : "Fatura bilgilerinizi ve ödeme yönteminizi onaylayın."}
            </DialogDescription>
            <DialogClose asChild><Button ref={closeButtonRef} type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-3 text-muted-foreground"><X className="size-4" /><span className="sr-only">Kapat</span></Button></DialogClose>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            {done ? (
              done.method === "card" ? (
                <div className="mx-auto max-w-lg py-3">
                  <CardPaymentPanel reference={done.reference} amountMinor={done.amountMinor} planLabel={`${pkg?.name} · ${cycle === "yearly" ? "Yıllık" : "Aylık"}`} />
                </div>
              ) : (
                <div className="mx-auto max-w-lg space-y-5 py-3" role="status">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-7 text-success-strong" aria-hidden="true" />
                    <div><h3 className="text-lg font-semibold">Havale talebiniz oluşturuldu</h3><p className="text-sm text-muted-foreground">Ödemeniz teyit edilince paketiniz güncellenecek.</p></div>
                  </div>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                    <dt className="text-muted-foreground">Tutar</dt><dd className="font-semibold">{formatMinor(done.amountMinor)}</dd>
                    <dt className="text-muted-foreground">Alıcı</dt><dd>{havale.accountTitle}</dd>
                    <dt className="text-muted-foreground">Banka</dt><dd>{havale.bank}</dd>
                    <dt className="text-muted-foreground">IBAN</dt><dd className="break-all font-mono">{havale.iban}</dd>
                    <dt className="text-muted-foreground">Açıklama</dt><dd className="font-mono font-semibold">{done.reference}</dd>
                  </dl>
                  <p className="text-sm text-muted-foreground">Havale açıklamasına referans kodunu yazın.</p>
                  <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Sayfaya dön</Button>
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Mevcut durum</p>
                    <p className="font-semibold">{isTrialing ? `${TRIAL_PLAN_NAME}${trialDaysLeft != null ? ` · ${trialDaysLeft} iş günü kaldı` : ""}` : currentPlanName}</p>
                  </div>
                </div>

                {hasPendingOrder && (
                  <Alert variant="warning"><AlertTriangle /><AlertDescription>
                    Bekleyen bir paket talebiniz var. Ödeme tamamlanana kadar yeni sipariş oluşturamazsınız.
                    {pendingMethod === "card" && <span className="mt-1 block">Bu pencereyi kapatıp sayfanın üstündeki bekleyen ödeme alanından devam edin.</span>}
                    {pendingMethod === "havale" && pendingReference && <span className="mt-1 block">Havale açıklaması: {pendingReference}</span>}
                  </AlertDescription></Alert>
                )}
                {!canPurchase && <Alert><AlertDescription>Paket değişikliği için yöneticinizle görüşün. Paketleri karşılaştırabilirsiniz.</AlertDescription></Alert>}
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(submit)} className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.85fr)]">
                    <div className="space-y-5">
                      <section className="rounded-xl border p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Seçilen paket</p><h3 className="mt-1 text-lg font-semibold">{pkg?.name}</h3></div><Badge variant="outline">{pkg?.seats} kullanıcı dahil</Badge></div>
                        <p className="mt-2 text-sm text-muted-foreground">{pkg?.tagline}</p>
                        <div className="mt-5"><BillingCycleSwitch cycle={cycle} onChange={(value) => form.setValue("cycle", value)} /></div>
                        <p className="mt-4 text-2xl font-semibold">{formatMinor(discountedAmount)} <span className="text-xs font-normal text-muted-foreground">/{cycle === "yearly" ? "yıl" : "ay"} · KDV dahil</span></p>
                        {referralDiscountBps > 0 && <p className="text-xs text-muted-foreground"><s>{formatMinor(catalogAmount)}</s> · İlk yıl referans indirimi %10</p>}
                      </section>
                      {excessSeats > 0 && <Alert variant="warning"><AlertTriangle /><AlertDescription>
                        Bu paket {getSeatLimit(tier, extraSeats)} koltuk destekliyor. Ödeme teyidinde {excessSeats} fazla kullanıcı veya davet devre dışı bırakılacak. Kayıt geçmişleri silinmeyecek.
                      </AlertDescription></Alert>}
                      {canPurchase && !hasPendingOrder && (
                        <section className="space-y-4 rounded-xl border p-4 sm:p-5">
                          <div><h3 className="font-semibold">Fatura bilgileri</h3><p className="text-xs text-muted-foreground">Sipariş oluşturulurken mevcut iş yerinize kaydedilir.</p></div>
                          <FormField control={form.control} name="invoiceTitle" render={({ field }) => <FormItem><FormLabel>Fatura ünvanı</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="taxNumber" render={({ field }) => <FormItem><FormLabel>Vergi / TC kimlik no</FormLabel><FormControl><Input {...field} inputMode="numeric" /></FormControl><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="taxOffice" render={({ field }) => <FormItem><FormLabel>Vergi dairesi (isteğe bağlı)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                          </div>
                        </section>
                      )}
                    </div>
                    <aside className="space-y-5 rounded-xl border bg-muted/30 p-4 sm:p-5" aria-label="Ödeme özeti">
                      <div><h3 className="font-semibold">Ödeme özeti</h3><p className="mt-1 text-xs text-muted-foreground">{pkg?.name} · {periodLabel} dönem</p></div>
                      <dl className="space-y-3 border-b pb-4 text-sm">
                        <div className="flex justify-between gap-3"><dt>Liste tutarı</dt><dd className="font-medium">{formatMinor(catalogAmount)}</dd></div>
                        {referralDiscountBps > 0 && <div className="flex justify-between gap-3"><dt>Referans indirimi (%10)</dt><dd>−{formatMinor(catalogAmount - discountedAmount)}</dd></div>}
                        <div className="flex justify-between gap-3"><dt>Dahil kullanıcı</dt><dd>{pkg?.seats}</dd></div>
                        {ownedTier && ownedTier !== tier && <div className="flex justify-between gap-3"><dt>Kalan dönem kredisi</dt><dd>Sonraki adımda</dd></div>}
                      </dl>
                      <div className="flex items-center justify-between gap-3 font-semibold"><span>{ownedTier && ownedTier !== tier ? "Kredi öncesi tutar" : "Ödenecek"}</span><span>{formatMinor(discountedAmount)}</span></div>
                      {ownedTier && ownedTier !== tier && <p className="text-xs text-muted-foreground">Kalan dönem kredisi uygulanır; kesin ödeme tutarı sipariş oluşturulduktan sonra gösterilir.</p>}
                      {canPurchase && !hasPendingOrder && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Ödeme yöntemi</p>
                        <ToggleGroup type="single" value={method} onValueChange={(value) => { if (value) form.setValue("method", value as "card" | "havale") }} className="grid grid-cols-2 gap-2" aria-label="Ödeme yöntemi">
                          <ToggleGroupItem value="card" variant="outline" className="h-auto min-h-9 flex-col gap-1 data-[state=on]:border-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"><CreditCard className="size-4" />Kart</ToggleGroupItem>
                          <ToggleGroupItem value="havale" variant="outline" className="h-auto min-h-9 flex-col gap-1 data-[state=on]:border-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"><Landmark className="size-4" />Havale/EFT</ToggleGroupItem>
                        </ToggleGroup>
                      </div>}
                      {canPurchase && !hasPendingOrder && <><p className="text-xs leading-5 text-muted-foreground">{method === "card" ? "Siparişten sonra kart bilgilerinizi girip bankanızın 3D Secure ekranına geçersiniz." : "Siparişten sonra havale talimatı ve referans kodu gösterilir. Paket, ödeme teyidinde etkinleşir."}</p>
                        <Button type="submit" variant="foreground" className="w-full" disabled={loading}>
                          {loading ? "Sipariş oluşturuluyor…" : "Siparişi oluştur"}
                        </Button>
                      </>}
                    </aside>
                  </form>
                </Form>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BillingCycleSwitch({ cycle, onChange }: { cycle: Cycle; onChange: (value: Cycle) => void }) {
  return (
    <ToggleGroup type="single" value={cycle} onValueChange={(value) => { if (value) onChange(value as Cycle) }} className="inline-grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1" aria-label="Faturalama dönemi">
      <ToggleGroupItem value="monthly" className="min-w-24 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">Aylık</ToggleGroupItem>
      <ToggleGroupItem value="yearly" className="min-w-24 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">Yıllık · 2 ay bedava</ToggleGroupItem>
    </ToggleGroup>
  )
}
