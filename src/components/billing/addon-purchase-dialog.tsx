"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { AlertTriangle, CreditCard, Landmark } from "lucide-react"
import { createAddonOrder } from "@/app/(app)/billing/addon-actions"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import { HavaleInstructions } from "@/components/billing/havale-instructions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { priceAddonOrder, type AddonOrderKey } from "@/lib/billing/addon-pricing"
import { formatMinor } from "@/lib/billing/pricing"
import type { HavaleInfo } from "@/lib/billing/provider"
import { formatTrDate } from "@/lib/format-date"
import { ADDON_CATALOG } from "@/lib/plans-catalog"
import { addonOrderSchema, type AddonOrderValues } from "@/lib/validations/addon-order"
import { typedResolver } from "@/lib/validations/resolver"

type Cycle = "monthly" | "yearly"
type OrderResult = { reference: string; amountMinor: number; method: "card" | "havale" }

/**
 * Ek özellik satın alma penceresi (#829). Tutar, açık ücretli dönemin kalan
 * gününe orantılanır (`priceAddonOrder` — sunucu aynı fonksiyonla yeniden
 * hesaplar); sonraki dönemden itibaren tam fiyat geçerlidir. Sipariş sonrası
 * kart paneli ya da havale talimatı paket siparişiyle aynı bileşenlerle gösterilir.
 */
export function AddonPurchaseDialog({
  addonKey,
  open,
  onOpenChange,
  billingCycle,
  currentPeriodEnd,
  hasPendingOrder,
  defaultInvoiceTitle,
  defaultTaxNumber,
  defaultTaxOffice,
  havale,
}: {
  addonKey: AddonOrderKey
  open: boolean
  onOpenChange: (open: boolean) => void
  billingCycle: Cycle
  currentPeriodEnd: Date | string
  hasPendingOrder: boolean
  defaultInvoiceTitle: string
  defaultTaxNumber: string
  defaultTaxOffice: string
  havale: HavaleInfo
}) {
  const router = useRouter()
  const addon = ADDON_CATALOG.find((a) => a.key === addonKey)
  const [now] = useState(() => new Date())
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<OrderResult | null>(null)

  const form = useForm<AddonOrderValues, unknown, AddonOrderValues>({
    resolver: typedResolver<AddonOrderValues>(addonOrderSchema),
    defaultValues: {
      items: [{ key: addonKey, quantity: 1 }],
      method: "card",
      invoiceTitle: defaultInvoiceTitle,
      taxNumber: defaultTaxNumber,
      taxOffice: defaultTaxOffice,
    },
  })
  const method = useWatch({ control: form.control, name: "method" })

  const periodEnd = useMemo(() => new Date(currentPeriodEnd), [currentPeriodEnd])
  const pricing = useMemo(() => {
    try {
      return priceAddonOrder({
        items: [{ key: addonKey, quantity: 1 }],
        cycle: billingCycle,
        currentPeriodEnd: periodEnd,
        now,
      })
    } catch {
      return null
    }
  }, [addonKey, billingCycle, periodEnd, now])

  if (!addon) return null
  const blocked = hasPendingOrder || pricing === null

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next && done) router.refresh()
  }

  async function submit(values: AddonOrderValues) {
    if (loading || blocked) return
    setLoading(true)
    setError("")
    try {
      const result = await createAddonOrder(values)
      if (result.ok) setDone(result)
      else setError(result.error)
    } catch {
      setError("Sipariş oluşturulamadı. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  const cycleUnit = billingCycle === "yearly" ? "yıl" : "ay"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{done ? "Siparişiniz" : `${addon.name} satın al`}</DialogTitle>
          <DialogDescription>
            {done ? "Sipariş tutarı ve sonraki adımlar aşağıda." : "Ek özellik, paketinizle aynı dönemde faturalanır ve tüm şubelerde geçerlidir."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          done.method === "card" ? (
            <CardPaymentPanel reference={done.reference} amountMinor={done.amountMinor} planLabel={`${addon.name} · ek özellik`} />
          ) : (
            <HavaleInstructions
              havale={havale}
              reference={done.reference}
              amountMinor={done.amountMinor}
              subtitle="Ödemeniz teyit edilince ek özellik etkinleşecek."
              onClose={() => handleOpenChange(false)}
            />
          )
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
              {hasPendingOrder && (
                <Alert variant="warning"><AlertTriangle /><AlertDescription>
                  Bekleyen bir talebiniz var. Ödeme tamamlanana kadar yeni sipariş oluşturamazsınız.
                </AlertDescription></Alert>
              )}
              {pricing === null && !hasPendingOrder && (
                <Alert variant="destructive"><AlertDescription>
                  Açık bir ücretli dönem bulunamadı. Önce paketinizi yenileyin.
                </AlertDescription></Alert>
              )}
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              {pricing && (
                <section className="space-y-3 rounded-md bg-muted/40 p-4" aria-label="Ödeme özeti">
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="font-medium">Bugün ödenecek</dt>
                      <dd className="text-lg font-semibold">{formatMinor(pricing.amountMinor)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Sonraki dönemden itibaren</dt>
                      <dd className="font-medium">{formatMinor(pricing.fullCycleAmountMinor)}/{cycleUnit}</dd>
                    </div>
                  </dl>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Tutar, mevcut dönemin sonuna ({formatTrDate(periodEnd)}) kadar kalan güne göre hesaplandı. Tüm tutarlar KDV dahildir.
                    {addon.includedUsage && ` Dahil: ${addon.includedUsage}.`}
                  </p>
                </section>
              )}

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Fatura bilgileri</h3>
                <FormField control={form.control} name="invoiceTitle" render={({ field }) => (
                  <FormItem><FormLabel>Fatura ünvanı</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="taxNumber" render={({ field }) => (
                    <FormItem><FormLabel>Vergi / TC kimlik no</FormLabel><FormControl><Input {...field} inputMode="numeric" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="taxOffice" render={({ field }) => (
                    <FormItem><FormLabel>Vergi dairesi (isteğe bağlı)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Ödeme yöntemi</p>
                <ToggleGroup
                  type="single"
                  size="control"
                  value={method}
                  onValueChange={(value) => { if (value) form.setValue("method", value as "card" | "havale") }}
                  className="grid grid-cols-2 gap-2"
                  aria-label="Ödeme yöntemi"
                >
                  <ToggleGroupItem value="card" variant="outline" className="gap-2"><CreditCard className="size-4" />Kart</ToggleGroupItem>
                  <ToggleGroupItem value="havale" variant="outline" className="gap-2"><Landmark className="size-4" />Havale/EFT</ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs leading-5 text-muted-foreground">
                  {method === "card"
                    ? "Siparişten sonra kart bilgilerinizi girip bankanızın 3D Secure ekranına geçersiniz."
                    : "Siparişten sonra havale talimatı ve referans kodu gösterilir. Ek özellik, ödeme teyidinde etkinleşir."}
                </p>
              </section>

              <Button type="submit" variant="foreground" className="w-full" disabled={loading || blocked}>
                {loading ? "Sipariş oluşturuluyor…" : "Siparişi oluştur"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
