"use client"

/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() cannot be memoized by React Compiler; usage is safe */

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Building2,
  User,
  Phone,
  MapPin,
  Check,
  ChevronRight,
  ChevronLeft,
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
import { formatPhoneTR } from "@/lib/format"
import { TR_CITIES } from "@/lib/tr-cities"
import { PLAN_PACKAGES, type PlanPackage } from "@/lib/plans-catalog"
import { cn } from "@/lib/utils"

const STEPS = [
  { label: "Paket Seçimi" },
  { label: "İşletme Bilgileri" },
  { label: "Hesap Bilgileri" },
  { label: "Onay" },
] as const

const registerWizardSchema = z.object({
  selectedPlan: z.enum(["starter", "pro", "premium"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
  workshopName: z.string().min(2, "İş yeri adı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  kvkkConsent: z.literal(true, { message: "Devam etmek için aydınlatma metnini onaylamanız gerekir" }),
})

type WizardFormValues = z.infer<typeof registerWizardSchema>

const STEP_FIELDS: Record<number, (keyof WizardFormValues)[]> = {
  0: ["selectedPlan", "billingPeriod"],
  1: ["workshopName", "phone", "city", "address"],
  2: ["firstName", "lastName", "email", "password"],
  3: ["kvkkConsent"],
}

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
}

const noopSubscribe = () => () => {}

export function RegisterForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(registerWizardSchema),
    defaultValues: {
      selectedPlan: "pro",
      billingPeriod: "monthly",
      workshopName: "",
      phone: "",
      city: "",
      address: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      kvkkConsent: undefined as unknown as true,
    },
    mode: "onTouched",
  })

  const billingPeriod = form.watch("billingPeriod")

  async function goNext() {
    const fields = STEP_FIELDS[currentStep]
    const valid = await form.trigger(fields)
    if (!valid) return
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
      const formData = new FormData()
      formData.set("workshopName", values.workshopName)
      formData.set("firstName", values.firstName)
      formData.set("lastName", values.lastName)
      formData.set("email", values.email)
      formData.set("phone", values.phone)
      formData.set("city", values.city)
      formData.set("address", values.address)
      formData.set("password", values.password)
      formData.set("kvkkConsent", "on")

      const res = await fetch("/api/auth/register", { method: "POST", body: formData })
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

          <div className="relative min-h-[320px]">
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
                {currentStep === 1 && <StepBusinessInfo form={form} />}
                {currentStep === 2 && (
                  <StepAccountInfo
                    form={form}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                  />
                )}
                {currentStep === 3 && <StepConfirmation form={form} />}
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
                Devam
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
    <nav aria-label="Kayıt adımları" className="flex items-center justify-between">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
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
                "text-xs font-medium hidden sm:block whitespace-nowrap",
                i <= currentStep ? "text-foreground" : "text-muted-foreground/60",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors",
                i < currentStep ? "bg-primary" : "bg-muted-foreground/20",
              )}
            />
          )}
        </div>
      ))}
    </nav>
  )
}

function StepPlanSelection({
  form,
  billingPeriod,
}: {
  form: ReturnType<typeof useForm<WizardFormValues>>
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

function StepBusinessInfo({ form }: { form: ReturnType<typeof useForm<WizardFormValues>> }) {
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

      <FormField
        control={form.control}
        name="city"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Şehir</FormLabel>
            <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <MapPin className="size-4 text-muted-foreground/70" />
                  <SelectValue placeholder="İl seçin" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {TR_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

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
    </div>
  )
}

function StepAccountInfo({
  form,
  showPassword,
  setShowPassword,
}: {
  form: ReturnType<typeof useForm<WizardFormValues>>
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

function StepConfirmation({ form }: { form: ReturnType<typeof useForm<WizardFormValues>> }) {
  const values = form.getValues()
  const planPkg = PLAN_PACKAGES.find((p) => p.tier === values.selectedPlan)
  const priceLabel = values.billingPeriod === "monthly" ? planPkg?.monthlyLabel : planPkg?.yearlyLabel

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Bilgilerinizi onaylayın</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aşağıdaki bilgilerin doğruluğunu kontrol edin.
        </p>
      </div>

      <div className="space-y-3">
        <SummaryRow label="Paket" value={`${planPkg?.name} — ${priceLabel}`} />
        <SummaryRow label="İş yeri" value={values.workshopName} />
        <SummaryRow label="Telefon" value={values.phone} />
        <SummaryRow label="Şehir" value={values.city} />
        <SummaryRow label="Adres" value={values.address} />
        <SummaryRow label="Ad Soyad" value={`${values.firstName} ${values.lastName}`} />
        <SummaryRow label="E-posta" value={values.email} />
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  )
}
