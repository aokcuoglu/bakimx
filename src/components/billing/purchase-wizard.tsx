"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Landmark, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { typedResolver } from "@/lib/validations/resolver"
import {
  checkoutInAppSchema,
  checkoutPublicSchema,
  type CheckoutInAppValues,
  type CheckoutPublicValues,
} from "@/lib/validations/billing"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import { createBillingOrder } from "@/app/(app)/billing/actions"
import type { PlanTier } from "@/lib/plan"
import type { HavaleInfo } from "@/lib/billing/provider"

type Mode = "public" | "inapp"
type Cycle = "monthly" | "yearly"

export function PurchaseWizard({
  mode,
  initialTier = "pro",
  initialCycle = "monthly",
  havale,
  defaultInvoiceTitle = "",
}: {
  mode: Mode
  initialTier?: PlanTier
  initialCycle?: Cycle
  havale: HavaleInfo
  defaultInvoiceTitle?: string
}) {
  const STEPS =
    mode === "public"
      ? ["Paket", "Hesap & Fatura", "Özet"]
      : ["Paket", "Fatura Bilgisi", "Özet"]
  const [step, setStep] = useState(0)
  const [tier, setTier] = useState<PlanTier>(initialTier)
  const [cycle, setCycle] = useState<Cycle>(initialCycle)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ reference: string; amountMinor: number } | null>(null)

  const schema = mode === "public" ? checkoutPublicSchema : checkoutInAppSchema
  const form = useForm<CheckoutPublicValues | CheckoutInAppValues>({
    resolver: typedResolver(schema as never) as never,
    defaultValues: {
      tier: initialTier,
      cycle: initialCycle,
      invoiceTitle: defaultInvoiceTitle,
      taxNumber: "",
      taxOffice: "",
      ...(mode === "public"
        ? {
            email: "",
            password: "",
            firstName: "",
            lastName: "",
            workshopName: "",
            phone: "",
            city: "",
            address: "",
            kvkkConsent: false,
          }
        : {}),
    } as never,
    mode: "onChange",
  })
  const { register, trigger, getValues, formState } = form
  const amountMinor = getPlanPriceMinor(tier, cycle)

  async function next(fields: string[]) {
    setError("")
    // keep tier/cycle in the form payload
    form.setValue("tier" as never, tier as never)
    form.setValue("cycle" as never, cycle as never)
    const valid = fields.length === 0 ? true : await trigger(fields as never)
    if (valid) setStep((s) => s + 1)
  }

  async function submit() {
    setError("")
    setLoading(true)
    try {
      const values = getValues() as Record<string, unknown>
      values.tier = tier
      values.cycle = cycle
      if (mode === "public") {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
        const data = await res.json()
        if (data.success) setDone({ reference: data.reference, amountMinor: data.amountMinor })
        else setError(data.error || "Satın alma başarısız")
      } else {
        const res = await createBillingOrder({
          tier,
          cycle,
          invoiceTitle: String(values.invoiceTitle ?? ""),
          taxNumber: String(values.taxNumber ?? ""),
          taxOffice: String(values.taxOffice ?? ""),
        })
        if (res.ok) setDone({ reference: res.reference, amountMinor })
        else setError(res.error)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Talebiniz alındı</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "public"
                ? "Hesabınız oluşturuldu. Ödemeniz teyit edilince giriş yapabilirsiniz."
                : "Havale teyidinden sonra paketiniz aktifleşecek."}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Landmark className="size-4 text-primary" /> Havale / EFT ile ödeme
            </div>
            <p className="text-muted-foreground">Tutar: <span className="font-semibold text-foreground">{formatMinor(done.amountMinor)}</span></p>
            <p className="text-muted-foreground">Alıcı: <span className="text-foreground">{havale.accountTitle}</span></p>
            <p className="text-muted-foreground">IBAN: <span className="text-foreground font-mono">{havale.iban}</span></p>
            <p className="text-muted-foreground">Banka: <span className="text-foreground">{havale.bank}</span></p>
            <p className="text-muted-foreground">
              Açıklama: <span className="font-semibold text-foreground inline-flex items-center gap-1">{done.reference} <Copy className="size-3" /></span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Lütfen açıklama kısmına <span className="font-semibold">{done.reference}</span> referansını yazın.
            </p>
          </div>
          {mode === "public" ? (
            <Link href="/login" className="text-sm text-primary hover:underline">Giriş sayfasına git</Link>
          ) : (
            <Link href="/billing" className="text-sm text-primary hover:underline">Paket sayfasına dön</Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* progress */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Adım {step + 1} / {STEPS.length}</span>
          <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={cn("flex-1 h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3">{error}</div>}

      {/* Step 0: plan + cycle */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Paket seçin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex w-full rounded-lg border bg-card p-1 gap-1">
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCycle(c)}
                  className={cn("flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {c === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"}
                </button>
              ))}
            </div>
            <div className="grid gap-3">
              {PLAN_PACKAGES.map((pkg) => {
                const selected = tier === pkg.tier
                const minor = getPlanPriceMinor(pkg.tier, cycle)
                return (
                  <button key={pkg.tier} type="button" onClick={() => setTier(pkg.tier)}
                    className={cn("flex items-center justify-between rounded-xl border p-4 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.tagline} · {pkg.seats} kullanıcı</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatMinor(minor)}</p>
                      <p className="text-[11px] text-muted-foreground">{cycle === "monthly" ? "/ay" : "/yıl"} · KDV dahil</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="pt-2 flex justify-end">
              <Button type="button" size="lg" className="h-12 gap-2" onClick={() => next([])}>Devam <ChevronRight className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: account (public) + invoice info */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>{mode === "public" ? "Hesap & fatura bilgisi" : "Fatura bilgisi"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mode === "public" && (
              <>
                <Field label="İş yeri adı" error={fieldError(formState, "workshopName")}><Input {...register("workshopName" as never)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ad" error={fieldError(formState, "firstName")}><Input {...register("firstName" as never)} /></Field>
                  <Field label="Soyad" error={fieldError(formState, "lastName")}><Input {...register("lastName" as never)} /></Field>
                </div>
                <Field label="E-posta" error={fieldError(formState, "email")}><Input type="email" {...register("email" as never)} /></Field>
                <Field label="Şifre" error={fieldError(formState, "password")}><Input type="password" {...register("password" as never)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefon" error={fieldError(formState, "phone")}><Input {...register("phone" as never)} /></Field>
                  <Field label="Şehir" error={fieldError(formState, "city")}><Input {...register("city" as never)} /></Field>
                </div>
                <Field label="Adres" error={fieldError(formState, "address")}><Input {...register("address" as never)} /></Field>
              </>
            )}
            <Field label="Fatura ünvanı" error={fieldError(formState, "invoiceTitle")}><Input {...register("invoiceTitle" as never)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vergi / TC no" error={fieldError(formState, "taxNumber")}><Input {...register("taxNumber" as never)} /></Field>
              <Field label="Vergi dairesi (ops.)" error={fieldError(formState, "taxOffice")}><Input {...register("taxOffice" as never)} /></Field>
            </div>
            {mode === "public" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                <input type="checkbox" {...register("kvkkConsent" as never)} className="mt-0.5" />
                <span><Link href="/privacy" className="text-primary hover:underline" target="_blank">Aydınlatma metnini</Link> okudum, onaylıyorum.</span>
              </label>
            )}
            <div className="pt-2 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
              <Button type="button" size="lg" className="h-12 gap-2"
                onClick={() => next(mode === "public"
                  ? ["workshopName", "firstName", "lastName", "email", "password", "phone", "city", "address", "invoiceTitle", "taxNumber", "kvkkConsent"]
                  : ["invoiceTitle", "taxNumber"])}>
                Devam <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: summary */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Özet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1.5">
              <p className="flex justify-between"><span className="text-muted-foreground">Paket</span><span className="font-medium text-foreground">{PLAN_PACKAGES.find((p) => p.tier === tier)?.name}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Dönem</span><span className="font-medium text-foreground">{cycle === "monthly" ? "Aylık" : "Yıllık"}</span></p>
              <p className="flex justify-between text-base"><span className="text-muted-foreground">Tutar (KDV dahil)</span><span className="font-bold text-foreground">{formatMinor(amountMinor)}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Ödeme ekibimizce teyit edilince {mode === "public" ? "hesabınız aktifleşir" : "paketiniz güncellenir"}.</p>
            <div className="pt-1 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
              <Button type="button" size="lg" disabled={loading} className="h-12 gap-2" onClick={submit}>
                {loading ? <><Loader2 className="size-4 animate-spin" /> Gönderiliyor…</> : "Siparişi oluştur"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function fieldError(formState: { errors: Record<string, { message?: string } | undefined> }, name: string): string | undefined {
  return formState.errors?.[name]?.message
}
