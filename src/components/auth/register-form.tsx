"use client"

/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() is the project-standard wizard pattern */

import {
  type ComponentType,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import styles from "./register-design.module.css"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod/v4"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  Car,
  CircleCheck,
  CircleDot,
  CreditCard,
  Database,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  Hammer,
  Handshake,
  Headphones,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paintbrush,
  Phone,
  ScanLine,
  Settings,
  Shield,
  Sparkles,
  Truck,
  User,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { toast } from "sonner"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { CitySelect, DistrictSelect } from "@/components/shared/location-select"
import { ACQUISITION_SOURCE_OPTIONS } from "@/lib/acquisition-sources"
import { formatPhoneTR } from "@/lib/format"
import { trackMarketingEvent, getStoredMarketingAttribution } from "@/lib/marketing-analytics"
import {
  REGISTER_STEPS,
  isRegisterSectorEnabled,
  recommendedRegisterModules,
  type BusinessFeatureId,
  type RegisterModuleId,
  type RegisterWizardSnapshot,
  type SetupPreferenceId,
  type TeamSizeId,
} from "@/lib/register-onboarding"
import { cn } from "@/lib/utils"
import type { SalePlanTier } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"
import { createRegisterFormSchema } from "@/lib/validations/register-form"
import { onboardingSchema } from "@/lib/validations/onboarding"
import { FIRST_ONBOARDING_PATH, onboardingStepIndex, onboardingStepPath } from "@/lib/onboarding-steps"
import { typedResolver } from "@/lib/validations/resolver"

type IconType = ComponentType<{ className?: string }>

type SectorOption = {
  id: string
  label: string
  description: string
  icon: IconType
  enabled: boolean
}

const SECTOR_CATALOG: Omit<SectorOption, "enabled">[] = [
  { id: "auto_service", label: "Oto Servis", description: "Araç bakım, onarım ve periyodik servis", icon: Car },
  { id: "mechanical_service", label: "Mekanik Servis", description: "Motor, şanzıman ve mekanik onarım", icon: Wrench },
  { id: "body_paint", label: "Kaporta & Boya", description: "Kaporta, boya ve kaplama hizmetleri", icon: Paintbrush },
  { id: "spare_parts", label: "Yedek Parça", description: "Parça satışı, stok ve sipariş", icon: Package },
  { id: "tire_service", label: "Lastik / Rot / Balans", description: "Lastik, rot ve balans hizmetleri", icon: CircleDot },
  { id: "auto_electric", label: "Oto Elektrik", description: "Elektrik arıza, akü ve aydınlatma", icon: Zap },
  { id: "upholstery", label: "Oto Döşeme", description: "Koltuk, deri ve iç mekân", icon: CircleDot },
  { id: "hardware", label: "Hırdavat", description: "Hırdavat ve yapı malzemeleri", icon: Hammer },
  { id: "car_wash", label: "Oto Yıkama", description: "Yıkama ve detaylı temizlik", icon: Droplets },
  { id: "steering", label: "Direksiyon Sistemleri", description: "Hidrolik ve elektrikli direksiyon", icon: Settings },
  { id: "other", label: "Diğer", description: "Farklı sektör veya karma işletme", icon: MoreHorizontal },
]

const SECTORS: SectorOption[] = SECTOR_CATALOG.map((sector) => ({
  ...sector,
  enabled: isRegisterSectorEnabled(sector.id),
})).sort((a, b) => Number(b.enabled) - Number(a.enabled))

const ENABLED_SECTORS = SECTORS.filter((sector) => sector.enabled)
const COMING_SOON_SECTORS = SECTORS.filter((sector) => !sector.enabled)
const SECTOR_LABEL_BY_ID = Object.fromEntries(SECTORS.map((sector) => [sector.id, sector.label])) as Record<
  string,
  string
>

const BUSINESS_QUESTIONS: {
  id: BusinessFeatureId
  label: string
  description: string
  icon: IconType
}[] = [
  { id: "stock", label: "Yedek parça / malzeme stoku tutuyor musunuz?", description: "Stok ve tedarikçi araçlarını öneririz.", icon: Boxes },
  { id: "fleet", label: "Filo veya kurumsal müşterileriniz var mı?", description: "Hatırlatma ve iletişim araçlarını öne çıkarırız.", icon: Building2 },
  { id: "insurance", label: "Sigorta şirketleriyle çalışıyor musunuz?", description: "Teklif ve servis geçmişi araçlarını öneririz.", icon: Shield },
  { id: "pickup_delivery", label: "Araç teslim alma / bırakma hizmetiniz var mı?", description: "Randevu ve müşteri iletişimini öne çıkarırız.", icon: Truck },
  { id: "virtual_pos", label: "Dijital ödeme takibi yapıyor musunuz?", description: "Kasa ve tahsilat araçlarını öneririz.", icon: CreditCard },
]

const TEAM_OPTIONS: { id: TeamSizeId; label: string; description: string }[] = [
  { id: "solo", label: "Sadece Ben", description: "Tek kişilik işletme" },
  { id: "2_5", label: "2–5 Kişi", description: "Küçük ekip" },
  { id: "6_10", label: "6–10 Kişi", description: "Orta ölçekli" },
  { id: "11_25", label: "11–25 Kişi", description: "Büyüyen işletme" },
  { id: "26_50", label: "26–50 Kişi", description: "Büyük işletme" },
  { id: "50_plus", label: "50+ Kişi", description: "Kurumsal" },
]

const MODULES: {
  id: RegisterModuleId
  label: string
  description: string
  icon: IconType
}[] = [
  { id: "customers_vehicles", label: "Müşteri & Araç", description: "Müşteri ve araç geçmişi", icon: Users },
  { id: "work_orders", label: "İş Emirleri", description: "Uçtan uca servis operasyonu", icon: FileText },
  { id: "appointments", label: "Randevular", description: "Takvim ve randevu takibi", icon: CalendarDays },
  { id: "reports", label: "Raporlar", description: "Operasyon ve müşteri raporları", icon: BarChart3 },
  { id: "stock_parts", label: "Stok & Parça", description: "Parça stoku ve hareketleri", icon: Boxes },
  { id: "quotes", label: "Teklifler", description: "Müşteri teklif ve onayları", icon: FileText },
  { id: "cashbox", label: "Kasa & Tahsilat", description: "Ödeme ve yaşlandırma takibi", icon: Wallet },
  { id: "suppliers", label: "Tedarikçiler", description: "Tedarikçi ve fiyat yönetimi", icon: Handshake },
  { id: "reminders", label: "Hatırlatmalar", description: "Periyodik bakım hatırlatmaları", icon: Bell },
  { id: "communications", label: "İletişim", description: "SMS, WhatsApp ve e-posta kayıtları", icon: MessageSquare },
  { id: "digital_intake", label: "Dijital Araç Kabul", description: "Ruhsat, fotoğraf ve hasar kaydı", icon: ScanLine },
  { id: "service_passport", label: "Servis Pasaportu", description: "Paylaşılabilir araç geçmişi", icon: BookOpen },
]

const SETUP_OPTIONS: { id: SetupPreferenceId; label: string; description: string; icon: IconType }[] = [
  { id: "self_service", label: "Kendim kuracağım", description: "Hemen başlayın; yardım merkezi yanınızda.", icon: Sparkles },
  { id: "data_migration", label: "Verilerimi taşıyalım", description: "Müşteri ve araç kayıtlarınızı birlikte aktaralım.", icon: Database },
  { id: "call_me", label: "Beni arayın", description: "Kurulum için ücretsiz destek isteyin.", icon: Headphones },
]


type WizardFormValues = z.infer<ReturnType<typeof createRegisterFormSchema>>
type WizardForm = UseFormReturn<WizardFormValues, unknown, WizardFormValues>

const STEP_FIELDS: Record<number, (keyof WizardFormValues)[]> = {
  0: ["sector"],
  1: [],
  2: ["teamSize"],
  3: ["selectedModules"],
  4: [
    "workshopName",
    "phone",
    "city",
    "address",
    "taxNumber",
    "firstName",
    "lastName",
    "email",
    "password",
    "confirmPassword",
    "acquisitionSource",
    "referralCode",
    "kvkkConsent",
  ],
}

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -48 : 48, opacity: 0 }),
}

const noopSubscribe = () => () => {}

export type SalesRegistrationPrefill = {
  token: string
  advisorName: string
  workshopName: string
  phone: string
  city: string
  district: string
  address: string
  firstName: string
  lastName: string
  email: string
}

export function RegisterForm({
  salesRegistration,
  preferredPlan,
  referralCode,
  onSnapshotChange,
  draftKey,
  mode = "register",
}: {
  mode?: "register" | "onboarding"
  salesRegistration?: SalesRegistrationPrefill
  preferredPlan?: { tier: SalePlanTier; cycle: "monthly" | "yearly" }
  referralCode?: string
  onSnapshotChange?: (snapshot: RegisterWizardSnapshot) => void
  draftKey?: string
}) {
  const onboarding = mode === "onboarding"
  const pathname = usePathname()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const currentStep = onboarding ? Math.max(0, onboardingStepIndex(pathname)) : 4
  const [direction, setDirection] = useState(1)
  const [draftReady, setDraftReady] = useState(!onboarding)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const startedRef = useRef(false)
  const submitRef = useRef(false)
  const stepScrollRef = useRef<HTMLDivElement>(null)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const form = useForm<WizardFormValues, unknown, WizardFormValues>({
    resolver: typedResolver(createRegisterFormSchema(onboarding)),
    defaultValues: {
      sector: "",
      businessFeatures: [],
      teamSize: "",
      selectedModules: recommendedRegisterModules([]),
      setupPreference: "self_service",
      acquisitionSource: salesRegistration ? "sales_advisor" : referralCode ? "referral" : "unknown",
      referralCode: referralCode ?? "",
      workshopName: salesRegistration?.workshopName ?? "",
      phone: salesRegistration?.phone ?? "",
      city: salesRegistration?.city ?? "",
      district: salesRegistration?.district ?? "",
      address: salesRegistration?.address ?? "",
      taxOffice: "",
      taxNumber: "",
      firstName: salesRegistration?.firstName ?? "",
      lastName: salesRegistration?.lastName ?? "",
      email: salesRegistration?.email ?? "",
      password: "",
      confirmPassword: "",
      kvkkConsent: false,
    },
    mode: "onTouched",
  })

  const sector = form.watch("sector")
  const businessFeatures = form.watch("businessFeatures")
  const teamSize = form.watch("teamSize")
  const selectedModules = form.watch("selectedModules")
  const city = form.watch("city")
  const acquisitionSource = form.watch("acquisitionSource")

  useEffect(() => {
    if (!onboarding || !draftKey) return
    try {
      const saved = sessionStorage.getItem(draftKey)
      if (saved) {
        const parsed = onboardingSchema.partial().safeParse(JSON.parse(saved))
        if (parsed.success) form.reset({ ...form.getValues(), ...parsed.data })
      }
    } catch {
      // A damaged or unavailable browser draft does not block setup.
    }
    setDraftReady(true)

    const subscription = form.watch((values) => {
      const candidate = {
        ...(values.sector ? { sector: values.sector } : {}),
        businessFeatures: values.businessFeatures,
        ...(values.teamSize ? { teamSize: values.teamSize } : {}),
        selectedModules: values.selectedModules,
        setupPreference: values.setupPreference,
      }
      if (onboardingSchema.partial().safeParse(candidate).success) {
        try { sessionStorage.setItem(draftKey, JSON.stringify(candidate)) } catch { /* storage may be disabled */ }
      }
    })
    return () => subscription.unsubscribe()
  }, [draftKey, form, onboarding])

  useEffect(() => {
    if (!onboarding || !draftReady) return
    if (currentStep > 0 && !sector) router.replace(FIRST_ONBOARDING_PATH)
    else if (currentStep > 2 && !teamSize) router.replace(onboardingStepPath(2))
  }, [currentStep, draftReady, onboarding, router, sector, teamSize])

  useEffect(() => {
    if (onboarding) stepScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
  }, [currentStep, onboarding])

  useEffect(() => {
    onSnapshotChange?.({
      currentStep,
      sector,
      businessFeatureCount: businessFeatures.length,
      teamSize,
      moduleCount: selectedModules.length,
    })
  }, [
    acquisitionSource,
    businessFeatures.length,
    currentStep,
    onSnapshotChange,
    sector,
    selectedModules.length,
    teamSize,
  ])

  async function goNext() {
    const fields = STEP_FIELDS[currentStep]
    const valid = fields.length === 0 || (await form.trigger(fields))
    if (!valid) return

    if (currentStep === 1 && !form.getFieldState("selectedModules").isDirty) {
      form.setValue("selectedModules", recommendedRegisterModules(form.getValues("businessFeatures")))
    }
    if (currentStep === 3) form.clearErrors(STEP_FIELDS[4])
    setDirection(1)
    router.push(onboardingStepPath(Math.min(currentStep + 1, 3)))
  }

  function goPrevious() {
    setDirection(-1)
    router.push(onboardingStepPath(Math.max(currentStep - 1, 0)))
  }

  async function handleSubmit(values: WizardFormValues) {
    if (submitRef.current || (onboarding && currentStep !== 3)) return
    submitRef.current = true
    setError("")
    setLoading(true)

    try {
      if (onboarding) {
        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector: values.sector, businessFeatures: values.businessFeatures, teamSize: values.teamSize, selectedModules: values.selectedModules, setupPreference: values.setupPreference }),
        })
        const result = await response.json()
        if (!response.ok || !result.ok) {
          setError(result.error || "Kurulum kaydedilemedi")
          return
        }
        if (draftKey) sessionStorage.removeItem(draftKey)
        window.location.assign("/dashboard")
        return
      }
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTier: preferredPlan?.tier ?? "pro",
          marketingAttribution: getStoredMarketingAttribution(),
          acquisitionSource: values.acquisitionSource,
          salesRegistrationToken: salesRegistration?.token,
          referralCode: values.referralCode || undefined,
          workshopName: values.workshopName,
          phone: values.phone,
          city: values.city,
          district: values.district || undefined,
          address: values.address,
          taxOffice: values.taxOffice || undefined,
          taxNumber: values.taxNumber || undefined,
          invoiceTitle: values.workshopName,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
          kvkkConsent: true,
        }),
      })
      const data = await response.json()
      if (!data.ok) {
        setError(data.error || "Kayıt tamamlanamadı")
        return
      }

      if (!data.resumed) {
        trackMarketingEvent("register_submitted", {
          entry_step: "account",
        })
      }
      setSubmitted(values.email.trim())
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      submitRef.current = false
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <section aria-labelledby="verification-heading" className="mx-auto w-full max-w-md py-4 text-foreground sm:py-8">
        <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted">
          <Mail aria-hidden="true" className="size-5" />
        </div>
        <h1 id="verification-heading" className="mt-6 text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">E-postanızı kontrol edin</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          <span className="break-words font-medium text-foreground">{submitted}</span> adresine doğrulama bağlantısı gönderdik.
        </p>
        <div className="mt-6 border-y border-border py-6">
          <p className="text-sm leading-6 text-foreground">
            Bağlantıya tıkladığınızda ücretsiz 7 iş günlük kullanımınız başlar.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Kart bilgisi gerekmez. Süre sonunda paket satın alınmazsa hesabınız ve verileriniz korunarak erişim dondurulur.
          </p>
        </div>
        <Button asChild variant="ghost" className="mt-6 text-muted-foreground">
          <Link href="/login"><ArrowLeft aria-hidden="true" className="size-4" />Giriş sayfasına dön</Link>
        </Button>
      </section>
    )
  }

  return (
    <div className={cn(styles.form, onboarding && "flex min-h-0 flex-1 flex-col")}>
      {onboarding && <MobileStepIndicator currentStep={currentStep} />}
      {preferredPlan && <PreferredPlanBanner tier={preferredPlan.tier} cycle={preferredPlan.cycle} />}

      <Form {...form}>
        <form
          className={cn(onboarding && "flex min-h-0 flex-1 flex-col")}
          onSubmit={form.handleSubmit(handleSubmit)}
          onChange={() => {
            if (onboarding || startedRef.current) return
            startedRef.current = true
            trackMarketingEvent("register_started", { entry_step: "account", plan_tier: preferredPlan?.tier ?? "pro" })
          }}
          method="post"
        >
          {error && (
            <Alert variant="destructive" aria-live="polite" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div ref={stepScrollRef} className={cn("relative", onboarding ? "min-h-[400px] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-3" : "min-h-[440px]")}>
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={reduceMotion || !onboarding ? { enter: { x: 0, opacity: 1 }, center: { x: 0, opacity: 1 }, exit: { x: 0, opacity: 1 } } : stepVariants}
                initial={false}
                animate="center"
                exit="exit"
                transition={{ duration: reduceMotion || !onboarding ? 0 : 0.2, ease: "easeInOut" }}
              >
                {currentStep === 0 && <SectorStep form={form} />}
                {currentStep === 1 && <BusinessDetailsStep form={form} />}
                {currentStep === 2 && <TeamSizeStep form={form} />}
                {currentStep === 3 && <><ModulesStep form={form} /><SetupStep form={form} /></>}
                {currentStep === 4 && (
                  <AccountStep
                    form={form}
                    city={city}
                    acquisitionSource={acquisitionSource}
                    salesAdvisorName={salesRegistration?.advisorName}
                    showPassword={showPassword}
                    onShowPasswordChange={setShowPassword}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className={cn("mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5", onboarding && "flex-col gap-2")}>
            {!onboarding ? (
              <Button asChild type="button" variant="outline">
                <Link href="/">
                  <ArrowLeft data-icon="inline-start" />
                  Ana Sayfa
                </Link>
              </Button>
            ) : currentStep > 0 ? (
              <Button type="button" variant="ghost" onClick={goPrevious} className="order-2 w-full text-muted-foreground">
                <ArrowLeft data-icon="inline-start" />
                Geri
              </Button>
            ) : null}
            <div className={onboarding ? "hidden" : "flex-1"} />
            {onboarding && currentStep < REGISTER_STEPS.length - 2 ? (
              <Button key="next-step" type="button" variant="foreground" onClick={goNext} disabled={currentStep === 0 && !sector} className="order-1 w-full">
                Devam Et
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button key="submit-form" type="submit" variant="foreground" disabled={loading || !hydrated} className={cn("max-sm:w-full", onboarding && "order-1 w-full")}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <BrandSpinner size={18} />
                    {onboarding ? "Kurulum kaydediliyor..." : "Hesap oluşturuluyor..."}
                  </span>
                ) : (
                  <>
                    <User data-icon="inline-start" />
                    {onboarding ? "Kurulumu Tamamla" : "Ücretsiz Hesabımı Oluştur"}
                  </>
                )}
              </Button>
            )}
          </div>

        </form>
      </Form>
    </div>
  )
}

function PreferredPlanBanner({
  tier,
  cycle,
}: {
  tier: SalePlanTier
  cycle: "monthly" | "yearly"
}) {
  const pkg = getPlanPackage(tier)
  if (!pkg) return null
  return (
    <div className="mb-5 rounded-lg border border-border bg-card px-4 py-3 lg:hidden">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3.5" />
        İlgilendiğiniz paket
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {pkg.name}
        <span className="ml-1.5 font-normal text-muted-foreground-strong">
          · {cycle === "yearly" ? pkg.yearlyLabel : pkg.monthlyLabel}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground-strong">
        Önce 7 iş günü ücretsiz deneyin; deneme bitince paketi kendi onayınızla etkinleştirebilirsiniz.
      </p>
    </div>
  )
}

function MobileStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Kurulum adımları" className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Adım {currentStep + 1} / 4</span>
        <span aria-current="step">{REGISTER_STEPS[currentStep].label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {REGISTER_STEPS.slice(0, 4).map((step, index) => (
          <span key={step.label} className={cn("h-1 rounded-full bg-muted", index <= currentStep && "bg-foreground")} />
        ))}
      </div>
    </nav>
  )
}

function StepHeading({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function SectorStep({ form }: { form: WizardForm }) {
  const [interestSector, setInterestSector] = useState<SectorOption | null>(null)

  return (
    <div>
      <StepHeading title="Sektörünüzü seçin" description="İşletmenize en uygun kategoriyi belirleyin; sisteminizi buna göre hazırlayalım." />
      <FormField
        control={form.control}
        name="sector"
        render={({ field }) => (
          <FormItem>
            <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
              <ToggleGroup
                type="single"
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
                className="contents"
                aria-label="Sektör seçimi"
              >
                {ENABLED_SECTORS.map((sector) => {
                  const Icon = sector.icon
                  return (
                    <ToggleGroupItem
                      key={sector.id}
                      value={sector.id}
                      variant="outline"
                      size="row"
                      className="relative w-full items-start"
                    >
                      <span className="flex w-full items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground group-data-[state=on]/toggle:border-primary group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground">{sector.label}</span>
                          <span className="mt-1 block text-xs leading-4 text-muted-foreground">{sector.description}</span>
                        </span>
                      </span>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>

            </div>
            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="coming-soon" className="border-t border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground">
                  Diğer sektörler <span className="ml-1 font-normal">(yakında)</span>
                </AccordionTrigger>
                <AccordionContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {COMING_SOON_SECTORS.map((sector) => {
                    const Icon = sector.icon
                    return (
                      <Button
                        key={sector.id}
                        type="button"
                        variant="outline"
                        size="row"
                        onClick={() => setInterestSector(sector)}
                        className="w-full items-start border-dashed hover:bg-muted/60"
                      >
                        <span className="flex w-full items-start gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">{sector.label}</span>
                            <span className="mt-1 block text-xs leading-4 text-muted-foreground">{sector.description}</span>
                            <span className="mt-1 block text-xs font-medium text-primary">İlgileniyorum</span>
                          </span>
                        </span>
                      </Button>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <FormMessage />
          </FormItem>
        )}
      />

      <Dialog
        open={interestSector !== null}
        onOpenChange={(open) => {
          if (!open) setInterestSector(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          {interestSector ? (
            <ComingSoonSectorInterestForm
              key={interestSector.id}
              sector={interestSector}
              onClose={() => setInterestSector(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

type SectorInterestForm = {
  name: string
  businessName: string
  phone: string
  city: string
}

const EMPTY_SECTOR_INTEREST: SectorInterestForm = {
  name: "",
  businessName: "",
  phone: "",
  city: "",
}

function ComingSoonSectorInterestForm({
  sector,
  onClose,
}: {
  sector: SectorOption
  onClose: () => void
}) {
  const [formData, setFormData] = useState<SectorInterestForm>(EMPTY_SECTOR_INTEREST)
  const [errors, setErrors] = useState<Partial<Record<keyof SectorInterestForm | "_general", string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const submitRef = useRef(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitRef.current) return

    const nextErrors: Partial<Record<keyof SectorInterestForm | "_general", string>> = {}
    if (formData.name.trim().length < 2) nextErrors.name = "Ad Soyad en az 2 karakter olmalıdır"
    if (formData.businessName.trim().length < 2) nextErrors.businessName = "İşletme adı en az 2 karakter olmalıdır"
    if (!formData.phone.trim()) {
      nextErrors.phone = "Telefon gerekli"
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(formData.phone.trim())) {
      nextErrors.phone = "Telefon numarası geçersiz görünüyor"
    }
    if (!formData.city.trim()) nextErrors.city = "Şehir seçin"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    submitRef.current = true
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          businessName: formData.businessName.trim(),
          phone: formData.phone.trim(),
          city: formData.city.trim(),
          monthlyVehicles: "belirtilmedi",
          notes: `[Sektör talebi: ${sector.label}] Yakında listesinden erken erişim talebi (kayıt sihirbazı).`,
        }),
      })
      if (res.ok) {
        trackMarketingEvent("demo_submitted", {
          form_location: "register_coming_soon_sector",
        })
        setIsSuccess(true)
        toast.success("Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.")
      } else {
        try {
          const data = (await res.json()) as { errors?: Record<string, string> }
          setErrors(data.errors ?? { _general: "Form gönderilemedi. Lütfen alanları kontrol edin." })
        } catch {
          setErrors({ _general: "Form gönderilemedi. Lütfen alanları kontrol edin." })
        }
      }
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." })
    } finally {
      submitRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{sector.label} — Yakında</DialogTitle>
        <DialogDescription>
          Bu sektör henüz kayıtta açık değil. Kısa formu doldurun; talebinizi önceliklendirip sizi haberdar edelim.
        </DialogDescription>
      </DialogHeader>

      {isSuccess ? (
        <div className="space-y-4 py-2">
          <Alert variant="success">
            <AlertDescription>
              Talebiniz kaydedildi. Ekibimiz sizinle iletişime geçecek.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="foreground" onClick={onClose}>
              Tamam
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sector-interest-name">Ad Soyad</Label>
            <Input
              id="sector-interest-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name ? <p className="text-xs text-destructive-strong">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector-interest-business">İşletme adı</Label>
            <Input
              id="sector-interest-business"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              autoComplete="organization"
              aria-invalid={errors.businessName ? true : undefined}
            />
            {errors.businessName ? (
              <p className="text-xs text-destructive-strong">{errors.businessName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector-interest-phone">Telefon</Label>
            <Input
              id="sector-interest-phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatPhoneTR(e.target.value) })}
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={errors.phone ? true : undefined}
            />
            {errors.phone ? <p className="text-xs text-destructive-strong">{errors.phone}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector-interest-city">Şehir</Label>
            <CitySelect
              id="sector-interest-city"
              value={formData.city}
              onValueChange={(city) => setFormData({ ...formData, city })}
            />
            {errors.city ? <p className="text-xs text-destructive-strong">{errors.city}</p> : null}
          </div>
          {errors._general ? (
            <p role="alert" className="text-sm text-destructive-strong">
              {errors._general}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" variant="foreground" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                "Beni haberdar et"
              )}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  )
}

function BusinessDetailsStep({ form }: { form: WizardForm }) {
  const sector = form.watch("sector")
  const sectorLabel = SECTOR_LABEL_BY_ID[sector] ?? "Seçtiğiniz sektör"

  return (
    <div>
      <StepHeading
        title="İş detayları"
        description={<><span className="font-medium text-foreground">{sectorLabel}</span> için birkaç soru — yanıtlarınıza göre başlangıç modüllerini önerelim.</>}
      />
      <FormField
        control={form.control}
        name="businessFeatures"
        render={({ field }) => (
          <FormItem>
            <div className="space-y-3">
              {BUSINESS_QUESTIONS.map((question) => {
                const Icon = question.icon
                const checked = field.value.includes(question.id)
                return (
                  <div key={question.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{question.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{question.description}</span>
                    </span>
                    <Switch
                      checked={checked}
                      onCheckedChange={(next) => {
                        field.onChange(next ? [...field.value, question.id] : field.value.filter((id) => id !== question.id))
                      }}
                      aria-label={question.label}
                    />
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">Seçimleriniz yalnız ilk kurulum önerisini belirler; daha sonra değiştirebilirsiniz.</p>
          </FormItem>
        )}
      />
    </div>
  )
}

function TeamSizeStep({ form }: { form: WizardForm }) {
  return (
    <div>
      <StepHeading title="Ekip büyüklüğünüz" description="Başlangıç görünümünü ekibinizin çalışma biçimine göre optimize edelim." />
      <FormField
        control={form.control}
        name="teamSize"
        render={({ field }) => (
          <FormItem>
            <ToggleGroup
              type="single"
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2"
              aria-label="Ekip büyüklüğü seçimi"
            >
              {TEAM_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.id}
                  value={option.id}
                  variant="outline"
                  size="row"
                  className="w-full flex-col justify-center gap-0 text-center"
                >
                  <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
                    <Users className="size-5" />
                  </span>
                  <span className="mt-3 text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 text-xs font-normal text-muted-foreground">{option.description}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function ModulesStep({ form }: { form: WizardForm }) {
  const sectorLabel = SECTOR_LABEL_BY_ID[form.watch("sector")] ?? "Seçtiğiniz sektör"

  return (
    <div>
      <StepHeading
        title="Modüllerinizi seçin"
        description={<><span className="font-medium text-foreground">{sectorLabel}</span> için önerilenleri işaretledik — istediğinizi ekleyip çıkarabilirsiniz.</>}
      />
      <FormField
        control={form.control}
        name="selectedModules"
        render={({ field }) => (
          <FormItem>
            <ToggleGroup
              type="multiple"
              value={field.value}
              onValueChange={field.onChange}
              className="grid w-full grid-cols-1 items-stretch gap-2 sm:grid-cols-2"
              aria-label="Modül seçimi"
            >
              {MODULES.map((module) => {
                const Icon = module.icon
                const selected = field.value.includes(module.id)
                return (
                  <ToggleGroupItem
                    key={module.id}
                    value={module.id}
                    variant="outline"
                    size="row"
                    className="w-full"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{module.label}</span>
                      <span className="mt-0.5 block text-[10px] font-normal leading-3 text-muted-foreground">{module.description}</span>
                    </span>
                    {selected ? <CircleCheck className="size-4 shrink-0 text-primary-strong" /> : <span className="size-4 shrink-0 rounded-full border border-border" />}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <FormMessage />
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground">
              <Sparkles className="size-4" />
              {field.value.length} modül seçildi
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}

function AccountStep({
  form,
  city,
  acquisitionSource,
  salesAdvisorName,
  showPassword,
  onShowPasswordChange,
}: {
  form: WizardForm
  city: string
  acquisitionSource: WizardFormValues["acquisitionSource"]
  salesAdvisorName?: string
  showPassword: boolean
  onShowPasswordChange: (value: boolean) => void
}) {
  useEffect(() => {
    // Resolver tüm şemayı değerlendirir; önceki adımın `trigger` çağrısından
    // kalan, henüz ziyaret edilmemiş hesap alanı hatalarını ilk girişte gösterme.
    form.clearErrors(STEP_FIELDS[4])
  }, [form])

  return (
    <div>
      <StepHeading title="Hesap bilgileriniz" description="Firma, iletişim ve giriş bilgilerinizi tamamlayın. Servis tercihlerinizi üyelikten sonra belirleyebilirsiniz." />

      <div className="space-y-7">
        <section className="border-b border-border pb-7">
          <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Firma bilgileri</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="workshopName" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Firma / servis adı *</FormLabel><div className="relative"><Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input {...field} placeholder="Örn: Kaya Oto Servis" className="pl-9" /></FormControl></div><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="taxOffice" render={({ field }) => (
              <FormItem><FormLabel>Vergi dairesi <span className="font-normal text-muted-foreground">(opsiyonel)</span></FormLabel><FormControl><Input {...field} placeholder="Örn: Kadıköy" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="taxNumber" render={({ field }) => (
              <FormItem><FormLabel>Vergi / TC kimlik no <span className="font-normal text-muted-foreground">(opsiyonel)</span></FormLabel><FormControl><Input {...field} inputMode="numeric" placeholder="10 veya 11 haneli numara" onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 11))} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </section>

        <section className="border-b border-border pb-7">
          <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">İletişim bilgileri</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Cep telefonu *</FormLabel><div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input {...field} type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" className="pl-9" onChange={(event) => field.onChange(formatPhoneTR(event.target.value))} /></FormControl></div><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>E-posta *</FormLabel><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input {...field} type="email" autoComplete="email" placeholder="ornek@servis.com" className="pl-9" /></FormControl></div><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="city" render={({ field }) => (
              <FormItem><FormLabel>İl *</FormLabel><FormControl><CitySelect value={field.value} onValueChange={field.onChange} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="district" render={({ field }) => (
              <FormItem><FormLabel>İlçe <span className="font-normal text-muted-foreground">(opsiyonel)</span></FormLabel><FormControl><DistrictSelect city={city} value={field.value || ""} onValueChange={field.onChange} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Açık adres *</FormLabel><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><FormControl><Input {...field} autoComplete="street-address" placeholder="Mahalle, cadde / sokak, kapı no" className="pl-9" /></FormControl></div><FormMessage /></FormItem>
            )} />
          </div>
        </section>

        <section className="border-b border-border pb-7">
          <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Giriş bilgileri</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem><FormLabel>Ad *</FormLabel><FormControl><Input {...field} autoComplete="given-name" placeholder="Adınız" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem><FormLabel>Soyad *</FormLabel><FormControl><Input {...field} autoComplete="family-name" placeholder="Soyadınız" /></FormControl><FormMessage /></FormItem>
            )} />
            <PasswordField form={form} name="password" label="Şifre *" showPassword={showPassword} onShowPasswordChange={onShowPasswordChange} />
            <PasswordField form={form} name="confirmPassword" label="Şifre tekrar *" showPassword={showPassword} onShowPasswordChange={onShowPasswordChange} />
          </div>
        </section>



        {salesAdvisorName ? (
          <section className="rounded-lg border border-border bg-card p-4 text-foreground sm:p-5">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">Güvenli danışman bağlantısı</h2>
                <p className="mt-1 text-xs leading-5">Bu kayıt {salesAdvisorName} tarafından size özel oluşturuldu. Firma bilgilerinizi kontrol edip hesabınızı tamamlayın.</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="border-b border-border pb-7">
            {acquisitionSource === "referral" && <p className="mb-4 text-sm text-foreground">Geçerli referans koduyla kaydolduğunuzda ücretli paketlerde ilk yıl %10 indirim kazanırsınız.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="acquisitionSource" render={({ field }) => (
                <FormItem><FormLabel>Bizi nereden duydunuz?</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{ACQUISITION_SOURCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              {acquisitionSource === "referral" && (
                <FormField control={form.control} name="referralCode" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Referans kodu *</FormLabel><FormControl><Input {...field} autoCapitalize="characters" autoComplete="off" placeholder="ÖRN: ORNEK-OTO" className="uppercase" onChange={(event) => field.onChange(event.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>
          </section>
        )}

        <FormField control={form.control} name="kvkkConsent" render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 py-1">
              <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} aria-label="Aydınlatma metni onayı" /></FormControl>
              <div className="text-xs leading-5 text-muted-foreground">
                <Link href="/kvkk" target="_blank" className="font-medium text-primary hover:underline">KVKK Aydınlatma Metni</Link>&apos;ni okudum. Hesabımın ücretsiz 7 iş günü kullanılacağını, satın alma yapılmazsa verilerim korunarak erişimin dondurulacağını biliyorum.
                <FormMessage />
              </div>
            </div>
          </FormItem>
        )} />
      </div>
    </div>
  )
}

function PasswordField({
  form,
  name,
  label,
  showPassword,
  onShowPasswordChange,
}: {
  form: WizardForm
  name: "password" | "confirmPassword"
  label: string
  showPassword: boolean
  onShowPasswordChange: (value: boolean) => void
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <FormControl><Input {...field} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="En az 8 karakter" className="pl-9 pr-9" /></FormControl>
            <Button type="button" variant="ghost" size="icon" onClick={() => onShowPasswordChange(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
        </div>
        <FormMessage />
      </FormItem>
    )} />
  )
}

function SetupStep({ form }: { form: WizardForm }) {
  return (
        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <h2 className="text-xs font-medium uppercase tracking-wide text-foreground">Kurulum & veri taşıma yardımı</h2>
            <Badge variant="outline" className="border-border text-muted-foreground">Ücretsiz</Badge>
          </div>
          <p className="mb-3 text-xs leading-5 text-muted-foreground-strong">Hesabı kendiniz kurabilir veya ekibimizden ücretsiz destek isteyebilirsiniz.</p>
          <FormField control={form.control} name="setupPreference" render={({ field }) => (
            <FormItem>
              <ToggleGroup type="single" value={field.value} onValueChange={(value) => value && field.onChange(value)} className="grid w-full grid-cols-1 items-stretch gap-2" aria-label="Kurulum desteği tercihi">
                {SETUP_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <ToggleGroupItem key={option.id} value={option.id} variant="outline" size="row" className="w-full">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span><span className="block text-xs font-semibold">{option.label}</span><span className="mt-0.5 block text-[10px] font-normal leading-3 text-muted-foreground-strong">{option.description}</span></span>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </FormItem>
          )} />
        </section>
  )
}
