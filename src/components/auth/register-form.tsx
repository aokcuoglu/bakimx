"use client"

/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() is the project-standard wizard pattern */

import {
  type ComponentType,
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
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
  Check,
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { CitySelect, DistrictSelect } from "@/components/shared/location-select"
import { ACQUISITION_SOURCES, ACQUISITION_SOURCE_OPTIONS } from "@/lib/acquisition-sources"
import { formatPhoneTR } from "@/lib/format"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import {
  BUSINESS_FEATURE_IDS,
  REGISTER_MODULE_IDS,
  REGISTER_SECTOR_IDS,
  REGISTER_STEPS,
  SETUP_PREFERENCE_IDS,
  TEAM_SIZE_IDS,
  recommendedRegisterModules,
  type BusinessFeatureId,
  type RegisterModuleId,
  type RegisterWizardSnapshot,
  type SetupPreferenceId,
  type TeamSizeId,
} from "@/lib/register-onboarding"
import { cn } from "@/lib/utils"
import { optionalReferralCodeSchema } from "@/lib/validations/referral-code"
import { typedResolver } from "@/lib/validations/resolver"

type IconType = ComponentType<{ className?: string }>

const SECTORS: {
  id: string
  label: string
  description: string
  icon: IconType
  enabled: boolean
}[] = [
  { id: "auto_service", label: "Oto Servis", description: "Araç bakım, onarım ve periyodik servis", icon: Car, enabled: true },
  { id: "mechanical_service", label: "Mekanik Servis", description: "Motor, şanzıman ve mekanik onarım", icon: Wrench, enabled: false },
  { id: "body_paint", label: "Kaporta & Boya", description: "Kaporta, boya ve kaplama hizmetleri", icon: Paintbrush, enabled: false },
  { id: "upholstery", label: "Oto Döşeme", description: "Koltuk, deri ve iç mekân", icon: CircleDot, enabled: false },
  { id: "spare_parts", label: "Yedek Parça", description: "Parça satışı, stok ve sipariş", icon: Package, enabled: false },
  { id: "tire_service", label: "Lastik / Rot / Balans", description: "Lastik, rot ve balans hizmetleri", icon: CircleDot, enabled: false },
  { id: "hardware", label: "Hırdavat", description: "Hırdavat ve yapı malzemeleri", icon: Hammer, enabled: false },
  { id: "auto_electric", label: "Oto Elektrik", description: "Elektrik arıza, akü ve aydınlatma", icon: Zap, enabled: false },
  { id: "car_wash", label: "Oto Yıkama", description: "Yıkama ve detaylı temizlik", icon: Droplets, enabled: false },
  { id: "steering", label: "Direksiyon Sistemleri", description: "Hidrolik ve elektrikli direksiyon", icon: Settings, enabled: false },
  { id: "other", label: "Diğer", description: "Farklı sektör veya karma işletme", icon: MoreHorizontal, enabled: false },
]

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

const registerWizardSchema = z
  .object({
    sector: z.union([z.literal(""), z.enum(REGISTER_SECTOR_IDS)]).refine(Boolean, "Sektör seçimi zorunludur"),
    businessFeatures: z.array(z.enum(BUSINESS_FEATURE_IDS)).default([]),
    teamSize: z.union([z.literal(""), z.enum(TEAM_SIZE_IDS)]).refine(Boolean, "Ekip büyüklüğü seçimi zorunludur"),
    selectedModules: z.array(z.enum(REGISTER_MODULE_IDS)).min(1, "En az bir modül seçin"),
    setupPreference: z.enum(SETUP_PREFERENCE_IDS),
    acquisitionSource: z.enum(ACQUISITION_SOURCES).default("unknown"),
    acquisitionAdvisorId: z.string().optional().default(""),
    referralCode: optionalReferralCodeSchema,
    workshopName: z.string().min(2, "Firma / servis adı zorunludur"),
    phone: z.string().min(10, "Geçerli bir telefon numarası girin"),
    city: z.string().min(1, "İl seçimi zorunludur"),
    district: z.string().optional().default(""),
    address: z.string().min(3, "Açık adres zorunludur"),
    taxOffice: z.string().optional().default(""),
    taxNumber: z
      .string()
      .optional()
      .default("")
      .refine((value) => !value || /^\d{10,11}$/.test(value), "Vergi / TC kimlik no 10 veya 11 haneli olmalıdır"),
    firstName: z.string().min(1, "Ad zorunludur"),
    lastName: z.string().min(1, "Soyad zorunludur"),
    email: z.email("Geçerli bir e-posta adresi girin"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(8, "Şifrenizi tekrar girin"),
    kvkkConsent: z.boolean().refine(Boolean, "Devam etmek için aydınlatma metnini onaylayın"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Şifreler eşleşmiyor" })
    }
    if (data.acquisitionSource === "referral" && !data.referralCode) {
      ctx.addIssue({ code: "custom", path: ["referralCode"], message: "Referans kodu zorunludur" })
    }
    if (data.acquisitionSource === "sales_advisor" && !data.acquisitionAdvisorId) {
      ctx.addIssue({ code: "custom", path: ["acquisitionAdvisorId"], message: "Satış temsilcisi seçimi zorunludur" })
    }
  })

type WizardFormValues = z.infer<typeof registerWizardSchema>
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
    "acquisitionAdvisorId",
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

export function RegisterForm({
  advisors = [],
  onSnapshotChange,
}: {
  advisors?: { id: string; label: string }[]
  onSnapshotChange?: (snapshot: RegisterWizardSnapshot) => void
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const startedRef = useRef(false)
  const submitRef = useRef(false)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const form = useForm<WizardFormValues, unknown, WizardFormValues>({
    resolver: typedResolver(registerWizardSchema),
    defaultValues: {
      sector: "",
      businessFeatures: [],
      teamSize: "",
      selectedModules: recommendedRegisterModules([]),
      setupPreference: "self_service",
      acquisitionSource: "unknown",
      acquisitionAdvisorId: "",
      referralCode: "",
      workshopName: "",
      phone: "",
      city: "",
      district: "",
      address: "",
      taxOffice: "",
      taxNumber: "",
      firstName: "",
      lastName: "",
      email: "",
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
    setCurrentStep((step) => Math.min(step + 1, REGISTER_STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goPrevious() {
    setDirection(-1)
    setCurrentStep((step) => Math.max(step - 1, 0))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSubmit(values: WizardFormValues) {
    if (submitRef.current) return
    submitRef.current = true
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: values.sector || "auto_service",
          businessFeatures: values.businessFeatures,
          teamSize: values.teamSize || "solo",
          selectedModules: values.selectedModules,
          setupPreference: values.setupPreference,
          acquisitionSource: values.acquisitionSource,
          acquisitionAdvisorId: values.acquisitionAdvisorId || undefined,
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

      trackMarketingEvent("register_submitted", {
        sector: "auto_service",
        team_size: values.teamSize || "solo",
        module_count: String(values.selectedModules.length),
      })
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-xl py-12 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-7 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">E-postanızı kontrol edin</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{submitted}</span> adresine doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda ücretsiz 7 iş günlük kullanımınız başlar.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Kart bilgisi gerekmez. Süre sonunda paket satın alınmazsa hesabınız ve verileriniz korunarak erişim dondurulur.
        </p>
        <Button asChild className="mt-7">
          <Link href="/login">Giriş sayfasına dön</Link>
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="w-full">
      <MobileStepIndicator currentStep={currentStep} />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          onChange={() => {
            if (startedRef.current) return
            startedRef.current = true
            trackMarketingEvent("register_started", { entry_step: "sector" })
          }}
          method="post"
        >
          {error && (
            <div role="alert" aria-live="polite" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive-strong">
              {error}
            </div>
          )}

          <div className="relative min-h-[440px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {currentStep === 0 && <SectorStep form={form} />}
                {currentStep === 1 && <BusinessDetailsStep form={form} />}
                {currentStep === 2 && <TeamSizeStep form={form} />}
                {currentStep === 3 && <ModulesStep form={form} />}
                {currentStep === 4 && (
                  <AccountStep
                    form={form}
                    city={city}
                    acquisitionSource={acquisitionSource}
                    advisors={advisors}
                    showPassword={showPassword}
                    onShowPasswordChange={setShowPassword}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-7 flex items-center gap-3 border-t border-border pt-5">
            {currentStep === 0 ? (
              <Button asChild type="button" variant="outline">
                <Link href="/">
                  <ArrowLeft data-icon="inline-start" />
                  Ana Sayfa
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={goPrevious}>
                <ArrowLeft data-icon="inline-start" />
                Geri
              </Button>
            )}
            <div className="flex-1" />
            {currentStep < REGISTER_STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} disabled={currentStep === 0 && !sector}>
                Devam Et
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading || !hydrated} size="xl">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <BrandSpinner size={18} />
                    Hesap oluşturuluyor...
                  </span>
                ) : (
                  <>
                    <User data-icon="inline-start" />
                    Ücretsiz Hesabımı Oluştur
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
            <span>© 2026 BakimX · Servisiniz kontrol altında</span>
            <span className="flex gap-4">
              <Link href="/kvkk" target="_blank" className="hover:text-foreground hover:underline">KVKK</Link>
              <Link href="/privacy" target="_blank" className="hover:text-foreground hover:underline">Gizlilik</Link>
              <Link href="/terms" target="_blank" className="hover:text-foreground hover:underline">Kullanım Koşulları</Link>
            </span>
          </div>
        </form>
      </Form>
    </div>
  )
}

function MobileStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Kayıt adımları" className="mb-7 lg:hidden">
      <div className="flex items-center gap-2">
        {REGISTER_STEPS.map((step, index) => (
          <Fragment key={step.label}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                index < currentStep && "border-primary bg-primary text-primary-foreground",
                index === currentStep && "border-primary bg-primary/10 text-primary-strong",
                index > currentStep && "border-border text-muted-foreground",
              )}
              aria-current={index === currentStep ? "step" : undefined}
              aria-label={`${index + 1}. ${step.label}`}
            >
              {index < currentStep ? <Check className="size-3.5" /> : index + 1}
            </span>
            {index < REGISTER_STEPS.length - 1 && (
              <span className={cn("h-px flex-1 bg-border", index < currentStep && "bg-primary")} />
            )}
          </Fragment>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-muted-foreground">
        {REGISTER_STEPS[currentStep].label}
      </p>
    </nav>
  )
}

function StepHeading({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function SectorStep({ form }: { form: WizardForm }) {
  return (
    <div>
      <StepHeading title="Sektörünüzü seçin" description="İşletmenize en uygun kategoriyi belirleyin; sisteminizi buna göre hazırlayalım." />
      <FormField
        control={form.control}
        name="sector"
        render={({ field }) => (
          <FormItem>
            <ToggleGroup
              type="single"
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Sektör seçimi"
            >
              {SECTORS.map((sector) => {
                const Icon = sector.icon
                return (
                  <ToggleGroupItem
                    key={sector.id}
                    value={sector.id}
                    disabled={!sector.enabled}
                    variant="outline"
                    className="relative h-auto min-h-28 w-full items-start justify-start rounded-xl p-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex w-full flex-col items-start">
                      <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">{sector.label}</span>
                      <span className="mt-1 text-xs leading-4 text-muted-foreground">{sector.description}</span>
                    </span>
                    {!sector.enabled && <Badge variant="secondary" className="absolute right-2 top-2">Yakında</Badge>}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function BusinessDetailsStep({ form }: { form: WizardForm }) {
  return (
    <div>
      <StepHeading
        title="İş detayları"
        description={<><span className="font-semibold text-primary">Oto Servis</span> için birkaç soru — yanıtlarınıza göre başlangıç modüllerini önerelim.</>}
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
                  <div key={question.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
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
              className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Ekip büyüklüğü seçimi"
            >
              {TEAM_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.id}
                  value={option.id}
                  variant="outline"
                  className="h-auto min-h-32 w-full flex-col rounded-xl p-4 text-center data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
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
  return (
    <div>
      <StepHeading
        title="Modüllerinizi seçin"
        description={<><span className="font-semibold text-primary">Oto Servis</span> için önerilenleri işaretledik — istediğinizi ekleyip çıkarabilirsiniz.</>}
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
              className="grid w-full grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4"
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
                    className="h-auto min-h-18 w-full justify-start rounded-xl p-2.5 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-data-[state=on]/toggle:bg-primary group-data-[state=on]/toggle:text-primary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{module.label}</span>
                      <span className="mt-0.5 block text-[10px] font-normal leading-3 text-muted-foreground">{module.description}</span>
                    </span>
                    {selected ? <CircleCheck className="size-4 shrink-0 text-primary" /> : <span className="size-4 shrink-0 rounded-full border border-border" />}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <FormMessage />
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary-strong">
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
  advisors,
  showPassword,
  onShowPasswordChange,
}: {
  form: WizardForm
  city: string
  acquisitionSource: WizardFormValues["acquisitionSource"]
  advisors: { id: string; label: string }[]
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
      <StepHeading title="Hesap bilgileriniz" description="Son adım — firma ve giriş bilgilerinizi tamamlayın. Kart bilgisi istemiyoruz." />

      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">Firma bilgileri</h2>
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

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">İletişim bilgileri</h2>
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

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">Giriş bilgileri</h2>
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

        <section className="rounded-xl border border-success/30 bg-success/10 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-success-strong" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-success-strong">Kurulum & veri taşıma yardımı</h2>
            <Badge variant="outline" className="border-success/30 text-success-strong">Ücretsiz</Badge>
          </div>
          <p className="mb-3 text-xs leading-5 text-muted-foreground-strong">Hesabı kendiniz kurabilir veya ekibimizden ücretsiz destek isteyebilirsiniz.</p>
          <FormField control={form.control} name="setupPreference" render={({ field }) => (
            <FormItem>
              <ToggleGroup type="single" value={field.value} onValueChange={(value) => value && field.onChange(value)} className="grid w-full grid-cols-1 items-stretch gap-2 sm:grid-cols-3" aria-label="Kurulum desteği tercihi">
                {SETUP_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <ToggleGroupItem key={option.id} value={option.id} variant="outline" className="h-auto min-h-20 w-full justify-start rounded-lg bg-background p-3 text-left whitespace-normal data-[state=on]:border-success data-[state=on]:bg-success/10 data-[state=on]:text-foreground">
                      <Icon className="size-4 shrink-0 text-success-strong" />
                      <span><span className="block text-xs font-semibold">{option.label}</span><span className="mt-0.5 block text-[10px] font-normal leading-3 text-muted-foreground-strong">{option.description}</span></span>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </FormItem>
          )} />
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="acquisitionSource" render={({ field }) => (
              <FormItem><FormLabel>Bizi nereden duydunuz?</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{ACQUISITION_SOURCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )} />
            {acquisitionSource === "sales_advisor" && advisors.length > 0 && (
              <FormField control={form.control} name="acquisitionAdvisorId" render={({ field }) => (
                <FormItem><FormLabel>Satış temsilcisi <span className="font-normal text-muted-foreground">(varsa)</span></FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Temsilci seçin" /></SelectTrigger></FormControl><SelectContent><SelectItem value="">Atanmadı</SelectItem>{advisors.map((advisor) => <SelectItem key={advisor.id} value={advisor.id}>{advisor.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
            )}
            {acquisitionSource === "referral" && (
              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Referans kodu *</FormLabel><FormControl><Input {...field} autoCapitalize="characters" autoComplete="off" placeholder="ÖRN: ORNEK-OTO" className="uppercase" onChange={(event) => field.onChange(event.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
          </div>
        </section>

        <FormField control={form.control} name="kvkkConsent" render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
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
