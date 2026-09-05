"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Controller, useForm } from "react-hook-form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, CheckCircle2, Landmark, Copy, CreditCard, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form } from "@/components/ui/form"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { typedResolver } from "@/lib/validations/resolver"
import {
  checkoutInAppSchema,
  checkoutPublicSchema,
  type CheckoutInAppValues,
  type CheckoutPublicValues,
} from "@/lib/validations/billing"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor, isComplimentaryPlan } from "@/lib/billing/pricing"
import { createBillingOrder } from "@/app/(app)/billing/actions"
import type { PlanTier } from "@/lib/plan"
import type { HavaleInfo } from "@/lib/billing/provider"
import { BrandRail } from "@/components/billing/brand-rail"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import { getPlanPackage } from "@/lib/plans-catalog"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { ACQUISITION_SOURCE_OPTIONS } from "@/lib/acquisition-sources"

type Mode = "public" | "inapp"
type Cycle = "monthly" | "yearly"
type PayMethod = "card" | "havale"

const DAY_LABELS = [
  { value: "1", short: "Pzt" },
  { value: "2", short: "Sal" },
  { value: "3", short: "Çar" },
  { value: "4", short: "Per" },
  { value: "5", short: "Cum" },
  { value: "6", short: "Cmt" },
  { value: "0", short: "Paz" },
]

export function PurchaseWizard({
  mode,
  initialTier = "pro",
  initialCycle = "monthly",
  initialStep = 0,
  ownedTier = null,
  havale,
  defaultInvoiceTitle = "",
  advisors = [],
}: {
  mode: Mode
  initialTier?: PlanTier
  initialCycle?: Cycle
  initialStep?: number
  /** Workshop's currently active tier (inapp only) — can't be re-purchased. */
  ownedTier?: PlanTier | null
  havale: HavaleInfo
  defaultInvoiceTitle?: string
  advisors?: { id: string; label: string }[]
}) {
  const isPublic = mode === "public"
  const STEPS = isPublic
    ? ["Paket", "Hesap & Fatura", "Özet"]
    : ["Paket", "Fatura Bilgisi", "Özet"]
  const [step, setStep] = useState(initialStep)
  const [tier, setTier] = useState<PlanTier>(initialTier)
  const [cycle, setCycle] = useState<Cycle>(initialCycle)
  const [method, setMethod] = useState<PayMethod>("card")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{
    reference: string
    amountMinor: number
    method: PayMethod
    complimentary: boolean
  } | null>(null)
  const submitRef = useRef(false)

  const schema = isPublic ? checkoutPublicSchema : checkoutInAppSchema
  const form = useForm<CheckoutPublicValues | CheckoutInAppValues>({
    resolver: typedResolver(schema as never) as never,
    defaultValues: {
      tier: initialTier,
      cycle: initialCycle,
      invoiceTitle: defaultInvoiceTitle,
      acquisitionSource: "unknown",
      acquisitionAdvisorId: "",
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
            district: "",
            address: "",
            workshopEmail: "",
            workingDays: "1,2,3,4,5",
            weekdayStart: "09:00",
            weekdayEnd: "18:00",
            kvkkConsent: false,
          }
        : {}),
    } as never,
    mode: "onChange",
  })
  const { register, trigger, getValues, formState } = form
  const reduce = useReducedMotion()
  const complimentary = isComplimentaryPlan(tier, cycle)

  async function next(fields: string[]) {
    setError("")
    // keep tier/cycle in the form payload
    form.setValue("tier" as never, tier as never)
    form.setValue("cycle" as never, cycle as never)
    const valid = fields.length === 0 ? true : await trigger(fields as never)
    if (valid) setStep((s) => s + 1)
  }

  async function submit() {
    if (submitRef.current) return
    submitRef.current = true
    setError("")
    setLoading(true)
    try {
      const effectiveMethod: PayMethod = complimentary ? "havale" : method
      const values = getValues() as Record<string, unknown>
      values.tier = tier
      values.cycle = cycle
      values.method = effectiveMethod
      if (isPublic) {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
        const data = await res.json()
        if (data.success) {
          trackMarketingEvent("purchase_submitted", { plan_tier: tier, billing_cycle: cycle, payment_method: effectiveMethod })
          setDone({ reference: data.reference, amountMinor: data.amountMinor, method: effectiveMethod, complimentary: Boolean(data.complimentary) })
        } else setError(data.error || "Satın alma başarısız")
      } else {
        const res = await createBillingOrder({
          tier,
          cycle,
          method: effectiveMethod,
          invoiceTitle: String(values.invoiceTitle ?? ""),
          taxNumber: String(values.taxNumber ?? ""),
          taxOffice: String(values.taxOffice ?? ""),
        })
        if (res.ok) {
          trackMarketingEvent("purchase_submitted", { plan_tier: tier, billing_cycle: cycle, payment_method: res.method })
          setDone({ reference: res.reference, amountMinor: res.amountMinor, method: res.method, complimentary: res.complimentary })
        }
        else setError(res.error)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      submitRef.current = false
      setLoading(false)
    }
  }

  // Her iki mod da tam ekran iki sütun; inapp yalnızca marka rayında daha dar bir kolon kullanır.
  const frameClass = isPublic
    ? "grid min-h-[100dvh] md:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"
    : "grid min-h-[100dvh] md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
  const formColClass = "px-5 py-8 sm:px-8 md:px-12 md:py-14"

  return (
    <div className={frameClass}>
      <BrandRail mode={mode} tier={tier} cycle={cycle} step={done ? 2 : step} />

      <div className={cn("flex flex-col bg-background", formColClass)}>
        {/* my-auto: boş alan varsa dikey ortalar, içerik taşarsa kırpmadan üstten başlar */}
        <div className="mx-auto w-full max-w-md md:my-auto">
          {done ? (
            done.complimentary ? (
              <ComplimentaryDonePanel mode={mode} />
            ) : done.method === "card" ? (
              <CardPaymentPanel
                reference={done.reference}
                amountMinor={done.amountMinor}
                planLabel={planLabelFor(tier, cycle)}
              />
            ) : (
              <DonePanel mode={mode} done={done} havale={havale} />
            )
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
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
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
                          <Button
                            key={c}
                            type="button"
                            onClick={() => setCycle(c)}
                            variant={cycle === c ? "default" : "ghost"}
                            className={cn(
                              "flex-1",
                              cycle === c
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {c === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"}
                          </Button>
                        ))}
                      </div>
                      <div className="grid gap-3">
                        {PLAN_PACKAGES.map((pkg) => {
                          const isOwned = ownedTier === pkg.tier
                          const selected = tier === pkg.tier
                          const minor = getPlanPriceMinor(pkg.tier, cycle)
                          return (
                            <Button
                              key={pkg.tier}
                              type="button"
                              onClick={() => setTier(pkg.tier)}
                              aria-pressed={selected}
                              variant="outline"
                              className={cn(
                                "relative h-auto min-h-16 w-full justify-between rounded-xl p-4 text-left whitespace-normal",
                                selected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                                  : "border-border hover:border-primary/40 hover:bg-muted/30",
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">{pkg.name}</p>
                                  {isOwned ? (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-strong">
                                      Mevcut paketiniz — Yenile
                                    </span>
                                  ) : pkg.popular ? (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-strong">
                                      Popüler
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {pkg.tagline} · {pkg.seats} kullanıcı
                                </p>
                              </div>
                              <div className="ml-3 shrink-0 text-right">
                                {pkg.listMonthlyLabel && (
                                  <s className="block text-xs text-muted-foreground">
                                    {cycle === "monthly" ? pkg.listMonthlyLabel : pkg.listYearlyLabel}
                                  </s>
                                )}
                                <p className="font-bold text-foreground">{formatMinor(minor)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {pkg.tier === "lite" ? "Açılışa özel · sınırlı süre" : cycle === "monthly" ? "/ay · KDV dahil" : "/yıl · KDV dahil"}
                                </p>
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          size="lg"
                          onClick={() => next([])}
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
                          <Field label="BakımX&apos;ı nereden duydunuz?" error={fieldError(formState, "acquisitionSource")}>
                            <Controller control={form.control} name={"acquisitionSource" as never} render={({ field }) => (
                              <Select value={String(field.value ?? "unknown")} onValueChange={field.onChange}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>{ACQUISITION_SOURCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                              </Select>
                            )} />
                          </Field>
                          <Field label="Satış temsilcisi" error={fieldError(formState, "acquisitionAdvisorId")}>
                            <Controller control={form.control} name={"acquisitionAdvisorId" as never} render={({ field }) => <Select value={String(field.value ?? "")} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Atanmadı" /></SelectTrigger><SelectContent><SelectItem value="">Atanmadı</SelectItem>{advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select>} />
                          </Field>
                          <div className="grid gap-3 sm:grid-cols-2">
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
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Telefon" error={fieldError(formState, "phone")}>
                              <Input {...register("phone" as never)} />
                            </Field>
                            <Field label="Şehir" error={fieldError(formState, "city")}>
                              <Input {...register("city" as never)} />
                            </Field>
                          </div>
                          <Field label="İlçe (opsiyonel)" error={fieldError(formState, "district")}>
                            <Input {...register("district" as never)} placeholder="Örnek: Kadıköy" />
                          </Field>
                          <Field label="Adres" error={fieldError(formState, "address")}>
                            <Input {...register("address" as never)} />
                          </Field>
                          <Field label="İşletme e-postası (opsiyonel)" error={fieldError(formState, "workshopEmail")}>
                            <Input type="email" {...register("workshopEmail" as never)} placeholder="servis@isyeri.com" />
                          </Field>
                        </>
                      )}
                      <Field label="Fatura ünvanı" error={fieldError(formState, "invoiceTitle")}>
                        <Input {...register("invoiceTitle" as never)} />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Vergi / TC no" error={fieldError(formState, "taxNumber")}>
                          <Input {...register("taxNumber" as never)} />
                        </Field>
                        <Field label="Vergi dairesi (ops.)" error={fieldError(formState, "taxOffice")}>
                          <Input {...register("taxOffice" as never)} />
                        </Field>
                      </div>
                      {isPublic && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-2">
                            <Clock className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">Çalışma Günleri</span>
                          </div>
                          <Controller
                            control={form.control}
                            name={"workingDays" as never}
                            render={({ field }) => {
                              const selectedDays = field.value ? String(field.value).split(",").filter(Boolean) : []
                              return (
                                <ToggleGroup
                                  type="multiple"
                                  value={selectedDays}
                                  onValueChange={(vals) => field.onChange(vals.join(","))}
                                  className="flex-wrap"
                                >
                                  {DAY_LABELS.map((day) => (
                                    <ToggleGroupItem
                                      key={day.value}
                                      value={day.value}
                                      variant="outline"
                                      className="rounded-lg px-3 py-1.5 text-sm font-medium data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong hover:border-primary/40"
                                    >
                                      {day.short}
                                    </ToggleGroupItem>
                                  ))}
                                </ToggleGroup>
                              )
                            }}
                          />
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground shrink-0">Saat:</span>
                            <Field label="" error={undefined} className="flex-1">
                              <Input {...register("weekdayStart" as never)} type="time" />
                            </Field>
                            <span className="text-muted-foreground">-</span>
                            <Field label="" error={undefined} className="flex-1">
                              <Input {...register("weekdayEnd" as never)} type="time" />
                            </Field>
                          </div>
                        </div>
                      )}
                      {isPublic && (
                        <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                          <Controller
                            control={form.control}
                            name={"kvkkConsent" as never}
                            render={({ field }) => (
                              <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label="KVKK ve açık rıza metinlerini onayla" />
                            )}
                          />
                          <span>
                            <Link href="/kvkk" className="text-primary hover:underline" target="_blank">
                              Aydınlatma metni
                            </Link>{" "}
                            ve{" "}
                            <Link href="/acik-riza" className="text-primary hover:underline" target="_blank">
                              açık rıza metnini
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

                  {/* Step 2: summary + payment method */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-foreground">Özet</h2>

                      {/* Ödeme yöntemi seçimi — kart görünümlü iki seçenek */}
                      {!complimentary && <div>
                        <Label className="text-xs">Ödeme yöntemi</Label>
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {(
                            [
                              { value: "card", label: "Kredi/Banka Kartı", icon: CreditCard },
                              { value: "havale", label: "Havale/EFT", icon: Landmark },
                            ] as const
                          ).map((opt) => {
                            const selected = method === opt.value
                            const Icon = opt.icon
                            return (
                              <Button
                                key={opt.value}
                                type="button"
                                onClick={() => setMethod(opt.value)}
                                aria-pressed={selected}
                                variant="outline"
                                className={cn(
                                  "h-auto min-h-8 justify-start gap-2 rounded-xl p-3 text-left whitespace-normal",
                                  selected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/40 text-foreground"
                                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30",
                                )}
                              >
                                <Icon className="size-4 shrink-0 text-primary" />
                                {opt.label}
                              </Button>
                            )
                          })}
                        </div>
                      </div>}

                      <p className="text-sm text-muted-foreground">
                        {complimentary
                          ? "Lite paketiniz açılışa özel kampanya kapsamında ücretsiz etkinleştirilecek. Kart veya havale bilgisi gerekmiyor."
                          : method === "card"
                          ? isPublic
                            ? "Onayladığınızda 3D Secure ödeme adımına geçersiniz. Ödeme onaylanınca paketiniz hemen aktifleşir."
                            : "Onayladığınızda 3D Secure ödeme adımına geçersiniz. Ödeme onaylanınca paketiniz hemen güncellenir."
                          : isPublic
                            ? "Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Hesabınız hemen kullanıma açılır; ödeme ekibimizce teyit edilince paketiniz aktifleşir."
                            : "Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Ödeme ekibimizce teyit edilince paketiniz güncellenir."}
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
                          disabled={loading}
                          onClick={submit}
                        >
                          {loading ? (
                            <>
                              <BrandSpinner size={20} /> Gönderiliyor…
                            </>
                          ) : complimentary ? (
                            "Ücretsiz etkinleştir"
                          ) : method === "card" ? (
                            "Ödemeye geç"
                          ) : (
                            "Siparişi oluştur"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ComplimentaryDonePanel({ mode }: { mode: Mode }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Lite paketiniz etkin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Açılışa özel kampanya uygulandı; ödeme yapmanız gerekmiyor.
        </p>
      </div>
      <Link href={mode === "public" ? "/login" : "/billing"} className="inline-block text-sm text-primary hover:underline">
        {mode === "public" ? "Giriş sayfasına git" : "Paket sayfasına dön"}
      </Link>
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
        <h2 className="text-lg font-bold text-foreground">Hesabınız hazır</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "public"
            ? "Hesabınız oluşturuldu, hemen giriş yapabilirsiniz. Ödemeniz teyit edilince paketiniz aktifleşir."
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

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <Label className="text-xs">{label}</Label>}
      {children}
      {/* Sabit yükseklikli validation slotu — mesaj gelince/gidince layout kaymaz */}
      <p className="min-h-[16px] text-xs leading-4 text-destructive-strong">{error ?? ""}</p>
    </div>
  )
}

function planLabelFor(tier: PlanTier, cycle: Cycle): string {
  const pkg = getPlanPackage(tier)
  const cycleLabel = cycle === "yearly" ? "Yıllık" : "Aylık"
  return pkg ? `${pkg.name} · ${cycleLabel}` : cycleLabel
}

function fieldError(
  formState: { errors: Record<string, { message?: string } | undefined> },
  name: string,
): string | undefined {
  return formState.errors?.[name]?.message
}
