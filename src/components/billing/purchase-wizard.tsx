"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Landmark, Copy } from "lucide-react"
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
import { BrandRail } from "@/components/billing/brand-rail"

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
  const isPublic = mode === "public"
  const STEPS = isPublic
    ? ["Paket", "Hesap & Fatura", "Özet"]
    : ["Paket", "Fatura Bilgisi", "Özet"]
  const [step, setStep] = useState(0)
  const [tier, setTier] = useState<PlanTier>(initialTier)
  const [cycle, setCycle] = useState<Cycle>(initialCycle)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ reference: string; amountMinor: number } | null>(null)

  const schema = isPublic ? checkoutPublicSchema : checkoutInAppSchema
  const form = useForm<CheckoutPublicValues | CheckoutInAppValues>({
    resolver: typedResolver(schema as never) as never,
    defaultValues: {
      tier: initialTier,
      cycle: initialCycle,
      invoiceTitle: defaultInvoiceTitle,
      taxNumber: "",
      taxOffice: "",
      ...(isPublic
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
  const reduce = useReducedMotion()

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
      if (isPublic) {
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
        if (res.ok) setDone({ reference: res.reference, amountMinor: res.amountMinor })
        else setError(res.error)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Çerçeve: public = tam ekran iki sütun; inapp = AppShell içinde kapsüllenmiş kart.
  const frameClass = isPublic
    ? "grid min-h-[100dvh] md:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"
    : "grid overflow-hidden rounded-2xl border bg-card shadow-sm md:min-h-[560px] md:grid-cols-[300px_minmax(0,1fr)]"
  const formColClass = isPublic ? "px-5 py-8 sm:px-8 md:px-12 md:py-14" : "p-5 md:p-8"

  return (
    <div className={frameClass}>
      <BrandRail mode={mode} tier={tier} cycle={cycle} step={done ? 2 : step} />

      <div className={cn("flex flex-col bg-background", formColClass)}>
        {/* my-auto: boş alan varsa dikey ortalar, içerik taşarsa kırpmadan üstten başlar */}
        <div className="mx-auto w-full max-w-md md:my-auto">
          {done ? (
            <DonePanel mode={mode} done={done} havale={havale} />
          ) : (
            <>
              {/* ilerleme */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Adım {step + 1} / {STEPS.length}
                  </span>
                  <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
                </div>
                <div className="flex gap-1.5">
                  {STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        i <= step ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reduce ? false : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {/* Step 0: plan + cycle */}
                  {step === 0 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-foreground">Paket seçin</h2>
                      <div className="inline-flex w-full gap-1 rounded-lg border bg-muted/40 p-1">
                        {(["monthly", "yearly"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCycle(c)}
                            className={cn(
                              "flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                              cycle === c
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {c === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-3">
                        {PLAN_PACKAGES.map((pkg) => {
                          const selected = tier === pkg.tier
                          const minor = getPlanPriceMinor(pkg.tier, cycle)
                          return (
                            <button
                              key={pkg.tier}
                              type="button"
                              onClick={() => setTier(pkg.tier)}
                              aria-pressed={selected}
                              className={cn(
                                "relative flex items-center justify-between rounded-xl border p-4 text-left transition-all",
                                selected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                                  : "border-border hover:border-primary/40 hover:bg-muted/30",
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">{pkg.name}</p>
                                  {pkg.popular && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                      Popüler
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {pkg.tagline} · {pkg.seats} kullanıcı
                                </p>
                              </div>
                              <div className="ml-3 shrink-0 text-right">
                                <p className="font-bold text-foreground">{formatMinor(minor)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {cycle === "monthly" ? "/ay" : "/yıl"} · KDV dahil
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          size="lg"                          onClick={() => next([])}
                        >
                          Devam <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 1: account (public) + invoice info */}
                  {step === 1 && (
                    <div className="space-y-1">
                      <h2 className="mb-3 text-lg font-bold text-foreground">
                        {isPublic ? "Hesap & fatura bilgisi" : "Fatura bilgisi"}
                      </h2>
                      {isPublic && (
                        <>
                          <Field label="İş yeri adı" error={fieldError(formState, "workshopName")}>
                            <Input {...register("workshopName" as never)} />
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Ad" error={fieldError(formState, "firstName")}>
                              <Input {...register("firstName" as never)} />
                            </Field>
                            <Field label="Soyad" error={fieldError(formState, "lastName")}>
                              <Input {...register("lastName" as never)} />
                            </Field>
                          </div>
                          <Field label="E-posta" error={fieldError(formState, "email")}>
                            <Input type="email" {...register("email" as never)} />
                          </Field>
                          <Field label="Şifre" error={fieldError(formState, "password")}>
                            <Input type="password" {...register("password" as never)} />
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Telefon" error={fieldError(formState, "phone")}>
                              <Input {...register("phone" as never)} />
                            </Field>
                            <Field label="Şehir" error={fieldError(formState, "city")}>
                              <Input {...register("city" as never)} />
                            </Field>
                          </div>
                          <Field label="Adres" error={fieldError(formState, "address")}>
                            <Input {...register("address" as never)} />
                          </Field>
                        </>
                      )}
                      <Field label="Fatura ünvanı" error={fieldError(formState, "invoiceTitle")}>
                        <Input {...register("invoiceTitle" as never)} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Vergi / TC no" error={fieldError(formState, "taxNumber")}>
                          <Input {...register("taxNumber" as never)} />
                        </Field>
                        <Field label="Vergi dairesi (ops.)" error={fieldError(formState, "taxOffice")}>
                          <Input {...register("taxOffice" as never)} />
                        </Field>
                      </div>
                      {isPublic && (
                        <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                          <input type="checkbox" {...register("kvkkConsent" as never)} className="mt-0.5" />
                          <span>
                            <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                              Aydınlatma metnini
                            </Link>{" "}
                            okudum, onaylıyorum.
                          </span>
                        </label>
                      )}
                      <div className="flex justify-between pt-3">
                        <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>
                          <ChevronLeft className="size-4" /> Geri
                        </Button>
                        <Button
                          type="button"
                          size="lg"                          onClick={() =>
                            next(
                              isPublic
                                ? ["workshopName", "firstName", "lastName", "email", "password", "phone", "city", "address", "invoiceTitle", "taxNumber", "kvkkConsent"]
                                : ["invoiceTitle", "taxNumber"],
                            )
                          }
                        >
                          Devam <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: summary */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-foreground">Özet</h2>
                      <p className="text-sm text-muted-foreground">
                        Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Ödeme ekibimizce
                        teyit edilince {isPublic ? "hesabınız aktifleşir" : "paketiniz güncellenir"}.
                      </p>
                      {!isPublic && (
                        <p className="text-xs text-muted-foreground">
                          Yükseltmede mevcut paketinizin kalan gün kredisi düşülür; kesin tutar onay ekranında
                          görünür.
                        </p>
                      )}
                      <div className="flex justify-between pt-1">
                        <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                          <ChevronLeft className="size-4" /> Geri
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          disabled={loading}                          onClick={submit}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Gönderiliyor…
                            </>
                          ) : (
                            "Siparişi oluştur"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DonePanel({
  mode,
  done,
  havale,
}: {
  mode: Mode
  done: { reference: string; amountMinor: number }
  havale: HavaleInfo
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Talebiniz alındı</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "public"
            ? "Hesabınız oluşturuldu. Ödemeniz teyit edilince giriş yapabilirsiniz."
            : "Havale teyidinden sonra paketiniz aktifleşecek."}
        </p>
      </div>
      <div className="space-y-1.5 rounded-lg border bg-muted/40 p-4 text-left text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Landmark className="size-4 text-primary" /> Havale / EFT ile ödeme
        </div>
        <p className="text-muted-foreground">
          Tutar: <span className="font-semibold text-foreground">{formatMinor(done.amountMinor)}</span>
        </p>
        <p className="text-muted-foreground">
          Alıcı: <span className="text-foreground">{havale.accountTitle}</span>
        </p>
        <p className="text-muted-foreground">
          IBAN: <span className="font-mono text-foreground">{havale.iban}</span>
        </p>
        <p className="text-muted-foreground">
          Banka: <span className="text-foreground">{havale.bank}</span>
        </p>
        <p className="text-muted-foreground">
          Açıklama:{" "}
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            {done.reference} <Copy className="size-3" />
          </span>
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          Lütfen açıklama kısmına <span className="font-semibold">{done.reference}</span> referansını yazın.
        </p>
      </div>
      {mode === "public" ? (
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Giriş sayfasına git
        </Link>
      ) : (
        <Link href="/billing" className="inline-block text-sm text-primary hover:underline">
          Paket sayfasına dön
        </Link>
      )}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {/* Sabit yükseklikli validation slotu — mesaj gelince/gidince layout kaymaz */}
      <p className="min-h-[16px] text-xs leading-4 text-destructive">{error ?? ""}</p>
    </div>
  )
}

function fieldError(
  formState: { errors: Record<string, { message?: string } | undefined> },
  name: string,
): string | undefined {
  return formState.errors?.[name]?.message
}
