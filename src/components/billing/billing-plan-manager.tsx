"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, CreditCard, Landmark, Receipt, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PlanPackages } from "@/components/billing/plan-packages"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import { createBillingOrder } from "@/app/(app)/billing/actions"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import type { HavaleInfo } from "@/lib/billing/provider"
import { getSeatLimit, type PlanTier, type SalePlanTier } from "@/lib/plan"
import { PLAN_COMPARISON, PLAN_PACKAGES, getPlanPackage } from "@/lib/plans-catalog"
import { typedResolver } from "@/lib/validations/resolver"
import { checkoutInAppSchema, type CheckoutInAppValues } from "@/lib/validations/billing"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { cn } from "@/lib/utils"

type Cycle = "monthly" | "yearly"
type PaymentResult = { reference: string; amountMinor: number; method: "card" | "havale"; complimentary: boolean }

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
  canPurchase,
  liteRegistrationOpen,
  liteFreeGranted,
  defaultInvoiceTitle,
  defaultTaxNumber,
  defaultTaxOffice,
  seatUsage,
  extraSeats,
  havale,
  showComparison = true,
  explorePlansHref,
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
  canPurchase: boolean
  liteRegistrationOpen: boolean
  liteFreeGranted: boolean
  defaultInvoiceTitle: string
  defaultTaxNumber: string
  defaultTaxOffice: string
  seatUsage: { activeUsers: number; pendingInvites: number; used: number }
  extraSeats: number
  havale: HavaleInfo
  showComparison?: boolean
  explorePlansHref?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"checkout" | "compare">("checkout")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<PaymentResult | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const initialTier = ownedTier === "lite" || ownedTier === "pro" || ownedTier === "premium" ? ownedTier : "pro"
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
  const complimentary = catalogAmount === 0 && (tier !== "lite" || liteFreeGranted || liteRegistrationOpen)
  const excessSeats = Math.max(0, seatUsage.used - getSeatLimit(tier, extraSeats))
  const periodLabel = cycle === "yearly" ? "yıllık" : "aylık"

  function choosePlan(nextTier: SalePlanTier, nextCycle: Cycle) {
    if (!open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      setDone(null)
    }
    form.setValue("tier", nextTier)
    form.setValue("cycle", nextCycle)
    setError("")
    setView("checkout")
    setOpen(true)
  }

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setDone(null)
      setError("")
      setView("checkout")
    } else if (done) {
      router.refresh()
    }
  }

  async function submit(values: CheckoutInAppValues) {
    if (loading || hasPendingOrder || !canPurchase) return
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
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Mevcut paket</Badge>
              {isTrialing && <Badge variant="secondary">Deneme</Badge>}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">{isTrialing ? "Premium denemesi" : currentPlanName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isTrialing
                ? `Lite hesabınız Premium haklarını kullanıyor${trialDaysLeft == null ? "." : ` · ${trialDaysLeft} iş günü kaldı.`}`
                : `${currentCycle === "yearly" ? "Yıllık" : currentCycle === "monthly" ? "Aylık" : ""} abonelik dönemi`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {explorePlansHref && <Button asChild variant="outline"><Link href={explorePlansHref}>Paketleri incele</Link></Button>}
            <Button type="button" variant="foreground" onClick={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; closeDialog(true) }}>
              <Receipt className="size-4" aria-hidden="true" /> Paketi yönet
            </Button>
          </div>
        </div>
      </div>

      {showComparison && <div id="paketler" className="scroll-mt-24 pt-2">
        <PlanPackages
          ownedTier={ownedTier}
          workshopName={workshopName}
          hasPendingOrder={hasPendingOrder}
          canPurchase={canPurchase}
          liteRegistrationOpen={liteRegistrationOpen}
          trialTier={isTrialing ? "premium" : null}
          onSelectPlan={choosePlan}
        />
      </div>}

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="flex max-h-[min(92dvh,900px)] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 sm:max-w-5xl" showCloseButton={false} onOpenAutoFocus={(event) => { event.preventDefault(); closeButtonRef.current?.focus() }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus() }}>
          <DialogHeader className="shrink-0 border-b bg-card px-5 py-4 pr-14 sm:px-7">
            <DialogTitle>{view === "compare" ? "Paketleri karşılaştır" : done ? "Siparişiniz" : "Paketi yönet"}</DialogTitle>
            <DialogDescription>
              {view === "compare" ? "İhtiyacınıza uygun paketi seçin." : done ? "Sipariş tutarı ve sonraki adımlar aşağıda." : "Paketinizi, fatura bilgilerinizi ve ödeme yönteminizi tek yerden yönetin."}
            </DialogDescription>
            <DialogClose asChild><Button ref={closeButtonRef} type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-3 text-muted-foreground"><X className="size-4" /><span className="sr-only">Kapat</span></Button></DialogClose>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            {done ? (
              done.complimentary ? (
                <div className="mx-auto max-w-lg space-y-4 py-8 text-center" role="status">
                  <CheckCircle2 className="mx-auto size-10 text-success-strong" aria-hidden="true" />
                  <h3 className="text-lg font-semibold">{pkg?.name} paketiniz etkin</h3>
                  <p className="text-sm text-muted-foreground">Ücretsiz paket etkinleştirildi. Ödeme yapmanız gerekmiyor.</p>
                  <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Sayfaya dön</Button>
                </div>
              ) : done.method === "card" ? (
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
            ) : view === "compare" ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="ghost" onClick={() => setView("checkout")}><ArrowLeft className="size-4" /> Ödeme özetine dön</Button>
                  <BillingCycleSwitch cycle={cycle} onChange={(value) => form.setValue("cycle", value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {PLAN_PACKAGES.map((plan) => {
                    const unavailable = plan.tier === "lite" && !liteRegistrationOpen && !liteFreeGranted
                    return (
                      <section key={plan.tier} className={cn("flex flex-col rounded-xl border bg-card p-4", plan.tier === tier && "border-foreground ring-1 ring-foreground")} aria-label={`${plan.name} paketi`}>
                        <div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold">{plan.name}</h3>{ownedTier === plan.tier && <Badge variant="outline">Mevcut</Badge>}</div>
                        <p className="mt-1 min-h-10 text-xs text-muted-foreground">{plan.tagline}</p>
                        <p className="mt-4 text-2xl font-semibold">{formatMinor(getPlanPriceMinor(plan.tier, cycle))}</p>
                        <p className="text-xs text-muted-foreground">/{cycle === "yearly" ? "yıl" : "ay"} · KDV dahil</p>
                        <Button type="button" variant={plan.tier === tier ? "foreground" : "outline"} className="mt-4 w-full" disabled={unavailable} onClick={() => choosePlan(plan.tier, cycle)}>
                          {plan.tier === tier ? <><Check className="size-4" /> Seçili paket</> : "Bu paketi seç"}
                        </Button>
                        {unavailable && <p className="mt-2 text-xs text-muted-foreground">Yeni Lite kayıtları kapalı.</p>}
                        <ul className="mt-5 space-y-2 border-t pt-4 text-xs text-muted-foreground">
                          {plan.highlights.slice(0, 4).map((highlight) => <li key={highlight} className="flex gap-2"><Check className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />{highlight}</li>)}
                        </ul>
                      </section>
                    )
                  })}
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <Table aria-label="Paket özelliklerini karşılaştırın" className="min-w-[650px]">
                    <TableHeader><TableRow><TableHead scope="col">Özellik ve limit</TableHead>{PLAN_PACKAGES.map((plan) => <TableHead key={plan.tier} scope="col" className="text-center">{plan.name}</TableHead>)}</TableRow></TableHeader>
                    {PLAN_COMPARISON.map((category) => <TableBody key={category.key}>
                      <TableRow className="bg-muted/40"><TableHead scope="rowgroup" colSpan={4} className="font-semibold">{category.label}</TableHead></TableRow>
                      {category.rows.map((row) => <TableRow key={row.key}>
                        <TableHead scope="row" className="whitespace-normal font-normal">{row.label}</TableHead>
                        {PLAN_PACKAGES.map((plan) => <TableCell key={plan.tier} className="text-center text-xs">{row.values[plan.tier].label}</TableCell>)}
                      </TableRow>)}
                    </TableBody>)}
                  </Table>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Mevcut durum</p>
                    <p className="font-semibold">{isTrialing ? `Ücretsiz deneme${trialDaysLeft != null ? ` · ${trialDaysLeft} iş günü kaldı` : ""}` : currentPlanName}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setView("compare")}>Paket değiştir</Button>
                </div>

                {hasPendingOrder && (
                  <Alert variant="warning"><AlertTriangle /><AlertDescription>
                    Bekleyen bir paket talebiniz var. Ödeme tamamlanana kadar yeni sipariş oluşturamazsınız.
                    {pendingMethod === "card" && pendingReference && <Button asChild variant="outline" size="sm" className="mt-2"><Link href={`/payment/result?ref=${encodeURIComponent(pendingReference)}`}>Ödemeye devam et</Link></Button>}
                    {pendingMethod === "havale" && pendingReference && <span className="mt-1 block">Havale açıklaması: {pendingReference}</span>}
                  </AlertDescription></Alert>
                )}
                {!canPurchase && <Alert><AlertDescription>Paket değişikliği için yöneticinizle görüşün. Paketleri karşılaştırabilirsiniz.</AlertDescription></Alert>}
                {tier === "lite" && !liteRegistrationOpen && !liteFreeGranted && <Alert variant="warning"><AlertDescription>Yeni Lite kayıtları kapalı. Diğer paketleri seçebilirsiniz.</AlertDescription></Alert>}
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(submit)} className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.85fr)]">
                    <div className="space-y-5">
                      <section className="rounded-xl border p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Seçilen paket</p><h3 className="mt-1 text-lg font-semibold">{pkg?.name}</h3></div><Badge variant="outline">{pkg?.seats} kullanıcı dahil</Badge></div>
                        <p className="mt-2 text-sm text-muted-foreground">{pkg?.tagline}</p>
                        <div className="mt-5"><BillingCycleSwitch cycle={cycle} onChange={(value) => form.setValue("cycle", value)} /></div>
                        <p className="mt-4 text-2xl font-semibold">{formatMinor(catalogAmount)} <span className="text-xs font-normal text-muted-foreground">/{cycle === "yearly" ? "yıl" : "ay"} · KDV dahil</span></p>
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
                        <div className="flex justify-between gap-3"><dt>Dahil kullanıcı</dt><dd>{pkg?.seats}</dd></div>
                        {ownedTier && ownedTier !== tier && <div className="flex justify-between gap-3"><dt>Kalan dönem kredisi</dt><dd>Sonraki adımda</dd></div>}
                      </dl>
                      <div className="flex items-center justify-between gap-3 font-semibold"><span>{complimentary ? "Ödenecek" : "Liste fiyatı"}</span><span>{formatMinor(catalogAmount)}</span></div>
                      {ownedTier && ownedTier !== tier && <p className="text-xs text-muted-foreground">Kalan dönem kredisi uygulanır; kesin ödeme tutarı sipariş oluşturulduktan sonra gösterilir.</p>}
                      {canPurchase && !hasPendingOrder && !complimentary && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Ödeme yöntemi</p>
                        <ToggleGroup type="single" value={method} onValueChange={(value) => { if (value) form.setValue("method", value as "card" | "havale") }} className="grid grid-cols-2 gap-2" aria-label="Ödeme yöntemi">
                          <ToggleGroupItem value="card" variant="outline" className="h-auto min-h-12 flex-col gap-1 data-[state=on]:border-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"><CreditCard className="size-4" />Kart</ToggleGroupItem>
                          <ToggleGroupItem value="havale" variant="outline" className="h-auto min-h-12 flex-col gap-1 data-[state=on]:border-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"><Landmark className="size-4" />Havale/EFT</ToggleGroupItem>
                        </ToggleGroup>
                      </div>}
                      {canPurchase && !hasPendingOrder && <><p className="text-xs leading-5 text-muted-foreground">{complimentary ? "Ücretsiz Lite paketi hemen etkinleşir." : method === "card" ? "Siparişten sonra kart bilgilerinizi girip bankanızın 3D Secure ekranına geçersiniz." : "Siparişten sonra havale talimatı ve referans kodu gösterilir. Paket, ödeme teyidinde etkinleşir."}</p>
                        <Button type="submit" variant="foreground" className="w-full" disabled={loading || (tier === "lite" && !liteRegistrationOpen && !liteFreeGranted)}>
                          {loading ? "Sipariş oluşturuluyor…" : complimentary ? "Ücretsiz etkinleştir" : "Siparişi oluştur"}
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
