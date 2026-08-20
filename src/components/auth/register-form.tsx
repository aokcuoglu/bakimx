"use client"

/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() cannot be memoized by React Compiler; usage is safe */

import { Fragment, useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form"
import { z } from "zod/v4"
import { typedResolver } from "@/lib/validations/resolver"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Building2,
  User,
  Phone,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  Clock,
  FileText,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { CitySelect, DistrictSelect } from "@/components/shared/location-select"
import { formatPhoneTR } from "@/lib/format"
import { PLAN_PACKAGES, type PlanPackage } from "@/lib/plans-catalog"
import { slugifyWorkshopCode } from "@/lib/workshop-code"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Paket Seçimi" },
  { label: "İşletme Bilgileri" },
  { label: "Vergi & Çalışma" },
  { label: "Ekip" },
  { label: "Hesap Bilgileri" },
  { label: "Onay" },
] as const

const registerWizardSchema = z.object({
  selectedPlan: z.enum(["starter", "pro", "premium"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
  workshopName: z.string().min(2, "İş yeri adı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  city: z.string().min(1, "Şehir zorunludur"),
  district: z.string().optional().default(""),
  address: z.string().min(1, "Adres zorunludur"),
  workshopEmail: z.string().optional().default(""),
  taxOffice: z.string().optional().default(""),
  taxNumber: z.string().optional().default(""),
  invoiceTitle: z.string().optional().default(""),
  weekdayStart: z.string().default("09:00"),
  weekdayEnd: z.string().default("18:00"),
  workingDays: z.string().default("1,2,3,4,5,6"),
  teamMembers: z
    .array(
      z.object({
        fullName: z.string().min(1, "İsim zorunludur"),
        role: z.enum(["usta", "teknisyen", "servis_danismani"]),
      }),
    )
    .default([]),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  kvkkConsent: z.literal(true, { message: "Devam etmek için aydınlatma metnini onaylamanız gerekir" }),
})

type WizardFormValues = z.infer<typeof registerWizardSchema>
type WizardForm = UseFormReturn<WizardFormValues, unknown, WizardFormValues>

const STEP_FIELDS: Record<number, (keyof WizardFormValues)[]> = {
  0: ["selectedPlan", "billingPeriod"],
  1: ["workshopName", "phone", "city", "address"],
  2: ["taxOffice", "taxNumber", "invoiceTitle", "weekdayStart", "weekdayEnd", "workingDays"],
  3: ["teamMembers"],
  4: ["firstName", "lastName", "email", "password"],
  5: ["kvkkConsent"],
}

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
}

const noopSubscribe = () => () => {}

const DAY_LABELS = [
  { value: "1", short: "Pzt" },
  { value: "2", short: "Sal" },
  { value: "3", short: "Çar" },
  { value: "4", short: "Per" },
  { value: "5", short: "Cum" },
  { value: "6", short: "Cmt" },
  { value: "0", short: "Paz" },
]

const ROLE_OPTIONS = [
  { value: "usta", label: "Usta" },
  { value: "teknisyen", label: "Teknisyen" },
  { value: "servis_danismani", label: "Servis Danışmanı" },
]

export function RegisterForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const form = useForm<WizardFormValues, unknown, WizardFormValues>({
    resolver: typedResolver(registerWizardSchema),
    defaultValues: {
      selectedPlan: "pro",
      billingPeriod: "monthly",
      workshopName: "",
      phone: "",
      city: "",
      district: "",
      address: "",
      workshopEmail: "",
      taxOffice: "",
      taxNumber: "",
      invoiceTitle: "",
      weekdayStart: "09:00",
      weekdayEnd: "18:00",
      workingDays: "1,2,3,4,5,6",
      teamMembers: [],
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      kvkkConsent: undefined as unknown as true,
    },
    mode: "onTouched",
  })

  const billingPeriod = form.watch("billingPeriod")
  const workshopName = form.watch("workshopName")
  const city = form.watch("city")

  async function goNext() {
    const fields = STEP_FIELDS[currentStep]
    // Step 3 (Ekip) has no required fields — always passes if array is empty
    if (currentStep === 3) {
      const members = form.getValues("teamMembers")
      if (members.length > 0) {
        const valid = await form.trigger("teamMembers")
        if (!valid) return
      }
    } else {
      const valid = await form.trigger(fields)
      if (!valid) return
    }
    setDirection(1)
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goPrev() {
    setDirection(-1)
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit(values: WizardFormValues) {
    setError("")
    setLoading(true)
    try {
      const body = {
        workshopName: values.workshopName,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        city: values.city,
        district: values.district || undefined,
        address: values.address,
        password: values.password,
        workshopEmail: values.workshopEmail || undefined,
        taxOffice: values.taxOffice || undefined,
        taxNumber: values.taxNumber || undefined,
        invoiceTitle: values.invoiceTitle || undefined,
        weekdayStart: values.weekdayStart,
        weekdayEnd: values.weekdayEnd,
        workingDays: values.workingDays,
        kvkkConsent: true,
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setSubmitted(values.email.trim())
      } else {
        setError(data.error || "Kayıt başarısız")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-2 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            E-postanızı kontrol edin
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            <span className="font-medium text-foreground">{submitted}</span> adresine bir doğrulama
            bağlantısı gönderdik. Bağlantıya tıkladığınızda 7 günlük ücretsiz denemeniz başlar ve
            otomatik olarak giriş yaparsınız.
          </p>
          <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
            E-posta birkaç dakika içinde gelmezse spam/gereksiz klasörünü kontrol edin. Bağlantı 48
            saat geçerlidir.
          </p>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary hover:underline transition-colors font-medium">
            Giriş yapın
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="w-full">
      <StepIndicator currentStep={currentStep} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} method="post" className="mt-8">
          {error && (
            <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-strong text-sm">
              {error}
            </div>
          )}

          <div className="relative min-h-[380px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {currentStep === 0 && (
                  <StepPlanSelection
                    form={form}
                    billingPeriod={billingPeriod}
                  />
                )}
                {currentStep === 1 && (
                  <StepBusinessInfo form={form} workshopName={workshopName} city={city} />
                )}
                {currentStep === 2 && <StepTaxAndHours form={form} />}
                {currentStep === 3 && <StepTeam form={form} />}
                {currentStep === 4 && (
                  <StepAccountInfo
                    form={form}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                  />
                )}
                {currentStep === 5 && <StepConfirmation form={form} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={goPrev} className="gap-1.5">
                <ChevronLeft className="size-4" />
                Geri
              </Button>
            )}
            <div className="flex-1" />
            {currentStep < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} className="gap-1.5">
                {currentStep === 3 ? "Atla / Devam" : "Devam"}
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading || !hydrated} className="gap-1.5">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <BrandSpinner size={18} />
                    Hesap oluşturuluyor...
                  </span>
                ) : (
                  "Hesap Oluştur"
                )}
              </Button>
            )}
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-primary hover:underline transition-colors font-medium">
              Giriş yapın
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Kayıt adımları" className="flex items-start justify-between">
      {STEPS.map((step, i) => (
        <Fragment key={step.label}>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                i < currentStep && "border-primary bg-primary text-primary-foreground",
                i === currentStep && "border-primary bg-primary/10 text-primary",
                i > currentStep && "border-muted-foreground/30 text-muted-foreground/50",
              )}
              aria-current={i === currentStep ? "step" : undefined}
            >
              {i < currentStep ? <Check className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium hidden sm:block whitespace-nowrap",
                i <= currentStep ? "text-foreground" : "text-muted-foreground/60",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mt-[15px] h-0.5 min-w-4 flex-1 mx-1.5 rounded-full transition-colors",
                i < currentStep ? "bg-primary" : "bg-muted-foreground/20",
              )}
            />
          )}
        </Fragment>
      ))}
    </nav>
  )
}

function StepPlanSelection({
  form,
  billingPeriod,
}: {
  form: WizardForm
  billingPeriod: "monthly" | "yearly"
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Paketinizi seçin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          E-posta doğrulamasının ardından 7 günlük ücretsiz deneme başlar.
        </p>
      </div>

      <FormField
        control={form.control}
        name="billingPeriod"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  field.value === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => field.onChange("monthly")}
              >
                Aylık
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  field.value === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => field.onChange("yearly")}
              >
                Yıllık
                <span className="ml-1 text-xs text-success-strong font-semibold">2 ay bedava</span>
              </button>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="selectedPlan"
        render={({ field }) => (
          <FormItem>
            <div className="grid gap-3">
              {PLAN_PACKAGES.map((pkg) => (
                <PlanCard
                  key={pkg.tier}
                  pkg={pkg}
                  billingPeriod={billingPeriod}
                  selected={field.value === pkg.tier}
                  onSelect={() => field.onChange(pkg.tier)}
                />
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function PlanCard({
  pkg,
  billingPeriod,
  selected,
  onSelect,
}: {
  pkg: PlanPackage
  billingPeriod: "monthly" | "yearly"
  selected: boolean
  onSelect: () => void
}) {
  const price = billingPeriod === "monthly" ? pkg.monthlyLabel : pkg.yearlyLabel

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary bg-primary" : "border-muted-foreground/40",
        )}
      >
        {selected && <Check className="size-3 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{pkg.name}</span>
          {pkg.popular && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Popüler
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{pkg.tagline}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">{price}</span>
    </button>
  )
}

function StepBusinessInfo({
  form,
  workshopName,
  city,
}: {
  form: WizardForm
  workshopName: string
  city: string
}) {
  const slug = workshopName.length >= 2 ? slugifyWorkshopCode(workshopName) : ""

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">İşletme bilgileri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Servisiniz hakkında temel bilgileri girin.
        </p>
      </div>

      <FormField
        control={form.control}
        name="workshopName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>İş yeri adı</FormLabel>
            <FormControl>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                <Input {...field} placeholder="Örnek Oto Servis" className="pl-9" />
              </div>
            </FormControl>
            {slug && (
              <p className="text-xs text-muted-foreground mt-1">
                bakimx.com/w/<span className="font-medium text-foreground">{slug}</span>
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Telefon</FormLabel>
            <FormControl>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  {...field}
                  type="tel"
                  inputMode="tel"
                  placeholder="0544 515 74 08"
                  className="pl-9"
                  onChange={(e) => {
                    field.onChange(formatPhoneTR(e.target.value))
                  }}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şehir</FormLabel>
              <FormControl>
                <CitySelect
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="district"
          render={({ field }) => (
            <FormItem>
              <FormLabel>İlçe</FormLabel>
              <FormControl>
                <DistrictSelect
                  city={city}
                  value={field.value || ""}
                  onValueChange={(v) => field.onChange(v)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Adres</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Sanayi Mah. 1. Cad. No:5" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="workshopEmail"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              İşletme e-postası <span className="text-muted-foreground font-normal">(opsiyonel)</span>
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                <Input {...field} type="email" placeholder="servis@isyeri.com" className="pl-9" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function StepTaxAndHours({ form }: { form: WizardForm }) {
  const workingDays = form.watch("workingDays")
  const selectedDays = workingDays ? workingDays.split(",").filter(Boolean) : []

  function toggleDay(day: string) {
    const current = new Set(selectedDays)
    if (current.has(day)) {
      current.delete(day)
    } else {
      current.add(day)
    }
    form.setValue("workingDays", Array.from(current).join(","), { shouldDirty: true })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="size-5" />
          Vergi & Çalışma Saatleri
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fatura ve çalışma bilgileriniz (tümü opsiyonel, sonradan da ayarlanabilir)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="taxOffice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vergi dairesi</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Kadıköy VD" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="taxNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vergi numarası</FormLabel>
              <FormControl>
                <Input {...field} placeholder="1234567890" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="invoiceTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Fatura ünvanı</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Örnek Oto Tamir Ltd. Şti." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Çalışma Günleri</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((day) => {
            const active = selectedDays.includes(day.value)
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {day.short}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0">Saat:</span>
          <FormField
            control={form.control}
            name="weekdayStart"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...field} type="time" />
                </FormControl>
              </FormItem>
            )}
          />
          <span className="text-muted-foreground">-</span>
          <FormField
            control={form.control}
            name="weekdayEnd"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...field} type="time" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}

function StepTeam({ form }: { form: WizardForm }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "teamMembers",
  })

  // BAK-107: Personel kaydı artık giriş hesabından ayrı açılamaz. İlk kayıt
  // sırasında geçici şifre/davet teslimi yapılamadığı için ekip, kurulumdan
  // sonra Ayarlar > Ekip'teki tek yüzeyden eklenir.
  const maxMembers = 0
  const canAdd = maxMembers > 0 && fields.length < maxMembers

  useEffect(() => {
    if (fields.length > maxMembers) {
      for (let i = fields.length - 1; i >= maxMembers; i--) {
        remove(i)
      }
    }
  }, [maxMembers, fields.length, remove])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="size-5" />
          Ekibiniz
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İş yerini kurduktan sonra personelinizi Ayarlar &gt; Ekip ekranından ekleyin. Her personele giriş hesabı birlikte açılır.
        </p>
      </div>

      {maxMembers === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Personel ekleme, hesap bilgilerinin güvenle teslim edilebilmesi için kurulumdan sonra yapılır.
          </p>
        </div>
      ) : fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz ekip üyesi eklenmedi
          </p>
        </div>
      ) : null}

      {maxMembers > 0 && (
        <>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`teamMembers.${index}.fullName`}
                  render={({ field: f }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input {...f} placeholder="Ad Soyad" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`teamMembers.${index}.role`}
                  render={({ field: f }) => (
                    <FormItem className="w-40">
                      <Select value={f.value} onValueChange={(v) => f.onChange(v)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive-strong"
                  aria-label="Üyeyi kaldır"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ fullName: "", role: "usta" })}
            disabled={!canAdd}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            {canAdd
              ? "Ekip üyesi ekle"
              : `Limit doldu (${maxMembers}/${maxMembers})`}
          </Button>
        </>
      )}
    </div>
  )
}

function StepAccountInfo({
  form,
  showPassword,
  setShowPassword,
}: {
  form: WizardForm
  showPassword: boolean
  setShowPassword: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Hesap bilgileri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Giriş yapacağınız kişisel bilgilerinizi girin.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ad</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                  <Input {...field} placeholder="Adınız" className="pl-9" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Soyad</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Soyadınız" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>E-posta</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                <Input {...field} type="email" autoComplete="email" placeholder="ornek@email.com" className="pl-9" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Şifre</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  {...field}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="En az 8 karakter"
                  className="pl-9 pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function StepConfirmation({ form }: { form: WizardForm }) {
  const values = form.getValues()
  const planPkg = PLAN_PACKAGES.find((p) => p.tier === values.selectedPlan)
  const priceLabel = values.billingPeriod === "monthly" ? planPkg?.monthlyLabel : planPkg?.yearlyLabel

  const workingDaysArr = values.workingDays ? values.workingDays.split(",").filter(Boolean) : []
  const dayNames = workingDaysArr
    .map((d) => DAY_LABELS.find((dl) => dl.value === d)?.short)
    .filter(Boolean)
    .join(", ")

  const hasTaxInfo = values.taxOffice || values.taxNumber || values.invoiceTitle

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Bilgilerinizi onaylayın</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aşağıdaki bilgilerin doğruluğunu kontrol edin.
        </p>
      </div>

      <div className="space-y-3">
        <SummarySection title="Paket">
          <SummaryRow label="Paket" value={`${planPkg?.name} — ${priceLabel}`} />
        </SummarySection>

        <SummarySection title="İşletme Bilgileri">
          <SummaryRow label="İş yeri" value={values.workshopName} />
          <SummaryRow label="Telefon" value={values.phone} />
          <SummaryRow
            label="Konum"
            value={[values.city, values.district].filter(Boolean).join(", ")}
          />
          <SummaryRow label="Adres" value={values.address} />
          {values.workshopEmail && (
            <SummaryRow label="İşletme e-postası" value={values.workshopEmail} />
          )}
        </SummarySection>

        {hasTaxInfo && (
          <SummarySection title="Vergi Bilgileri">
            {values.taxOffice && <SummaryRow label="Vergi dairesi" value={values.taxOffice} />}
            {values.taxNumber && <SummaryRow label="Vergi no" value={values.taxNumber} />}
            {values.invoiceTitle && <SummaryRow label="Fatura ünvanı" value={values.invoiceTitle} />}
          </SummarySection>
        )}

        <SummarySection title="Çalışma Saatleri">
          <SummaryRow label="Günler" value={dayNames || "Belirtilmedi"} />
          <SummaryRow label="Saat" value={`${values.weekdayStart} - ${values.weekdayEnd}`} />
        </SummarySection>

        <SummarySection title="Ekip">
          {values.teamMembers.length > 0 ? (
            values.teamMembers.map((m, i) => (
              <SummaryRow
                key={i}
                label={m.fullName}
                value={ROLE_OPTIONS.find((r) => r.value === m.role)?.label || m.role}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground px-3 py-1.5">Henüz eklenmedi</p>
          )}
        </SummarySection>

        <SummarySection title="Hesap Bilgileri">
          <SummaryRow label="Ad Soyad" value={`${values.firstName} ${values.lastName}`} />
          <SummaryRow label="E-posta" value={values.email} />
        </SummarySection>
      </div>

      <FormField
        control={form.control}
        name="kvkkConsent"
        render={({ field }) => (
          <FormItem>
            <label className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
                  className="mt-0.5"
                  aria-label="Kullanım koşulları ve aydınlatma metinlerini onayla"
                />
              </FormControl>
              <span>
                <Link href="/terms" target="_blank" className="text-primary hover:underline">Kullanım koşulları</Link>,{" "}
                <Link href="/kvkk" target="_blank" className="text-primary hover:underline">aydınlatma metni</Link> ve{" "}
                <Link href="/acik-riza" target="_blank" className="text-primary hover:underline">açık rıza metnini</Link> okudum, onaylıyorum.
              </span>
            </label>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  )
}
