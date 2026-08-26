/* eslint-disable react-hooks/incompatible-library */
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, User, ClipboardList, Camera, Car, Gauge, Plus } from "lucide-react"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { intakeSchema, type IntakeFormValues } from "@/lib/validations/intake"
import { typedResolver } from "@/lib/validations/resolver"
import { VehicleEntryWizard } from "@/components/intake/vehicle-entry-wizard"
import { WizardStepper } from "@/components/intake/wizard-ui"
import { FuelLevelPicker } from "@/components/intake/fuel-gauge"
import { PhotoAnnotate } from "@/components/intake/photo-annotate"
import { DamageCapture } from "@/components/intake/damage-capture"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ARRIVAL_REASON_ORDER, ARRIVAL_REASONS } from "@/lib/constants"
import { hasFeature, type PlanTier } from "@/lib/plan"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

// Seçili aracın kabul ekranında salt-görüntü özet kartında gösterilen bilgileri
// (/api/vehicles/[id] cevabının alt kümesi). Servis yetkilisinin gireceği "yeni
// kilometre"den ayrıştırmak için aracın son kayıtlı km'si burada referans durur.
type VehicleInfo = {
  plate: string
  brand: string
  model: string
  mileage: number | null
  modelYear: number | null
  fuelType: string | null
  transmission: string | null
  color: string | null
  vin: string | null
  firstRegistrationDate: string | null
  inspectionValidUntil: string | null
}

const STEPS = [
  { id: 1, label: "Müşteri & Araç", icon: User },
  { id: 3, label: "Kabul", icon: ClipboardList },
  { id: 4, label: "Fotoğraf", icon: Camera },
]

export function IntakeWizard({
  customers: initialCustomers,
  prefillCustomerId,
  prefillVehicleId,
  source,
  planTier,
}: {
  customers: Customer[]
  prefillCustomerId?: string
  prefillVehicleId?: string
  source?: string
  planTier?: string
}) {
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [customers] = useState(initialCustomers)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [intakeId, setIntakeId] = useState("")
  const [orderId, setOrderId] = useState("")
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null)

  const form = useForm<IntakeFormValues, unknown, IntakeFormValues>({
    resolver: typedResolver(intakeSchema),
    defaultValues: {
      selectedCustomerId: "",
      newFirstName: "",
      newLastName: "",
      newPhone: "",
      selectedVehicleId: "",
      newPlate: "",
      newBrand: "",
      newModel: "",
      newMileage: "",
      mileageAtIntake: "",
      fuelLevelAtIntake: "",
      customerComplaint: "",
      internalNote: "",
      droppedOffByName: "",
      droppedOffByPhone: "",
      arrivalReason: "",
      termsAccepted: false,
      privacyAccepted: false,
      serviceInfoAccepted: false,
      promoAccepted: false,
      otpCode: "",
    },
    mode: "onChange",
  })

  const selectedCustomerId = form.watch("selectedCustomerId")
  const selectedVehicleId = form.watch("selectedVehicleId")
  const customerComplaint = form.watch("customerComplaint")
  const mileageAtIntake = form.watch("mileageAtIntake")

  // Km geriye gidemez: girilen yeni km, aracın son kayıtlı km'sinden düşükse kabul
  // engellenir. Boş alan "" → girilmemiş sayılır (0'a çevrilip yanlış tetiklememesi
  // için parseInt kullanılıyor; NaN ise kontrol dışı bırakılır).
  const enteredKm = mileageAtIntake ? parseInt(mileageAtIntake, 10) : null
  const lastKm = vehicleInfo?.mileage ?? null
  const kmTooLow = enteredKm != null && !Number.isNaN(enteredKm) && lastKm != null && enteredKm < lastKm

  // Step completion tracking
  const completedSteps = new Set<number>()
  if (selectedCustomerId && selectedVehicleId) completedSteps.add(1)
  if (customerComplaint.trim()) completedSteps.add(3)

  // Prefill from OCR redirect (registration scanner)
  useEffect(() => {
    if (prefillCustomerId && customers.find((c) => c.id === prefillCustomerId)) {
      form.setValue("selectedCustomerId", prefillCustomerId)
    }
    if (prefillVehicleId) {
      form.setValue("selectedVehicleId", prefillVehicleId)
      if (source === "registration") setStep(3)
    }
  }, [prefillCustomerId, prefillVehicleId, source, customers, form])

  // Seçili aracın bilgilerini kabul ekranındaki salt-görüntü özet kartı için çek.
  // Son kayıtlı km artık "Yeni Kilometre" alanına ÖN-DOLDURULMUYOR: eski ve yeni
  // km'yi ayrıştırmak için son km yalnızca sağ paneldeki özet kartta referans olur.
  useEffect(() => {
    if (!selectedVehicleId) { setVehicleInfo(null); return }
    let active = true
    fetch(`/api/vehicles/${selectedVehicleId}`)
      .then((r) => r.json())
      .then((v: unknown) => {
        if (!active || !v || typeof v !== "object" || "error" in v) return
        setVehicleInfo(v as VehicleInfo)
      })
      .catch(() => {})
    return () => { active = false }
  }, [selectedVehicleId])

  // Seçimi URL'e yansıt. Next router'ın kendi replace()'i kullanılıyor (ham
  // history.replaceState değil) — aksi halde Next'in istemci router cache'i URL
  // değişikliğinden habersiz kalıyor ve "Detay" linkiyle çıkıp geri dönüldüğünde
  // eski (param'sız) önbelleklenmiş render'ı geri getiriyor. router.replace ile
  // sunucu bileşeni bu param'ları prefillCustomerId/prefillVehicleId olarak okuyup
  // VehicleEntryWizard'ın zaten var olan rehydrate mekanizmasını besler.
  function syncSelectionToUrl(customerId: string, vehicleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (customerId) params.set("customerId", customerId)
    else params.delete("customerId")
    if (vehicleId) params.set("vehicleId", vehicleId)
    else params.delete("vehicleId")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Kaydet & Yeni: bu iş emri zaten kaydedildi (foto adımına gelindiyse POST
  // başarılı olmuş). Wizard'ı sıfırdan başlat — peş peşe birden çok araç kabul
  // ederken her seferinde /orders/new'e gidip sayfayı yeniden yüklemeye gerek
  // kalmasın.
  function handleSaveAndNew() {
    form.reset()
    setIntakeId("")
    setOrderId("")
    setVehicleInfo(null)
    setError("")
    setStep(1)
    // URL'deki önceki müşteri/araç seçimini temizle (rehydrate/prefill tetiklenmesin)
    router.replace(pathname, { scroll: false })
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleCreateIntake() {
    const valid = await form.trigger(["customerComplaint"])
    if (!valid) return
    // Km geriye gidemez — buton zaten devre dışı ama guard olarak da engelle.
    if (kmTooLow) {
      setError(`Yeni kilometre, aracın son kaydından (${lastKm!.toLocaleString("tr-TR")} km) düşük olamaz.`)
      return
    }
    // Kabul zaten oluşturulduysa (Adım 3'e geri dönüp tekrar ilerleme) yeniden
    // POST'lama — çift kabul kaydı oluşmasın; sadece foto adımına geç.
    if (intakeId) { setStep(4); return }
    const values = form.getValues()
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("customerId", values.selectedCustomerId)
      formData.set("vehicleId", values.selectedVehicleId)
      formData.set("customerComplaint", values.customerComplaint)
      formData.set("mileageAtIntake", values.mileageAtIntake)
      formData.set("fuelLevelAtIntake", values.fuelLevelAtIntake)
      formData.set("internalNote", values.internalNote)
      formData.set("arrivalReason", values.arrivalReason)
      formData.set("droppedOffByName", values.droppedOffByName)
      formData.set("droppedOffByPhone", values.droppedOffByPhone)

      const res = await fetch("/api/intakes", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success && data.id) {
        setIntakeId(data.id)
        if (data.orderId) setOrderId(data.orderId)
        setStep(4)
      } else {
        setError(data.error || "Kabul oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  // Sihirbaz rayı: üst seviye üç adım. Araç girişinin kendi alt adımları
  // (yöntem → yakalama → araç → müşteri → onay) 1. adımın içinde yaşar (#309).
  const railSteps = STEPS.map((s) => ({ id: String(s.id), label: s.label }))
  const railCompleted = [...completedSteps].map(String)

  return (
    <Form {...form}>
      <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <WizardStepper
          className="lg:sticky lg:top-20"
          steps={railSteps}
          currentId={String(step)}
          completedIds={railCompleted}
          onStepClick={(id) => setStep(Number(id))}
        />

        <div className="space-y-6">
          {source === "registration" && selectedCustomerId && selectedVehicleId && (
            <Alert className="border-primary/30 bg-primary/5 text-primary">
              <Check className="size-4" />
              <AlertDescription>Ruhsattan kaydedilen müşteri ve araç seçildi. Kabul detaylarından devam edin.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

        {/* Step 1: Customer & Vehicle */}
        {step === 1 && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <VehicleEntryWizard
                value={{ customerId: selectedCustomerId, vehicleId: selectedVehicleId }}
                onChange={(v) => {
                  form.setValue("selectedCustomerId", v.customerId, { shouldValidate: true })
                  form.setValue("selectedVehicleId", v.vehicleId, { shouldValidate: true })
                  syncSelectionToUrl(v.customerId, v.vehicleId)
                }}
                onComplete={() => setStep(3)}
                planTier={planTier}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Intake details — iki kolon: sol=servis yetkilisinin girdiği kabul
            detayları, sağ=aracın salt-görüntü geçmiş/bilgi özeti. Mobilde alt alta yığılır
            (araç bilgileri formun altına düşer). */}
        {step === 3 && (
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {/* Bölüm-1: Kabul detayları */}
            <Card>
              <CardHeader><CardTitle>Kabul Detayları</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="mileageAtIntake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yeni Kilometre</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="50000"
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                        />
                      </FormControl>
                      {kmTooLow ? (
                        <p className="text-xs text-destructive-strong">
                          Yeni kilometre, aracın son kaydından ({lastKm!.toLocaleString("tr-TR")} km) düşük olamaz.
                        </p>
                      ) : vehicleInfo?.mileage != null ? (
                        <p className="text-xs text-muted-foreground">
                          Son kayıtlı: {vehicleInfo.mileage.toLocaleString("tr-TR")} km
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fuelLevelAtIntake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yakıt Seviyesi</FormLabel>
                      <FormControl>
                        <FuelLevelPicker
                          value={field.value === "" ? null : Number(field.value)}
                          onChange={(v) => field.onChange(v == null ? "" : String(v))}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Gösterge panelindeki ibreyi işaretleyin. Fotoğrafı bir sonraki adımda ekleyeceksiniz.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerComplaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Şikayeti *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Müşterinin şikayetini detaylı olarak yazınız..."
                          className="min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="arrivalReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servise Geliş Nedeni</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seçiniz (opsiyonel)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Belirtilmedi</SelectItem>
                          {ARRIVAL_REASON_ORDER.map((r) => (
                            <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="internalNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İç Not</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-[80px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* #196 — aracı müşteri değil başkası getirdiyse kaydedilsin.
                    Opsiyonel ve akışı tıkamayacak şekilde en alta konuldu:
                    vakaların çoğunda müşteri aracı kendi getiriyor. */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-sm font-medium text-foreground">Aracı getiren kişi</p>
                  <p className="text-xs text-muted-foreground">
                    Aracı müşterinin kendisi getirdiyse boş bırakın.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="droppedOffByName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ad Soyad</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Örn. Ahmet Yılmaz" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="droppedOffByPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefon</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" inputMode="tel" placeholder="Örn. 0532 000 0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg">
                    Geri
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateIntake}
                    disabled={loading || !customerComplaint.trim() || kmTooLow}
                    size="lg"
                    className="gap-2"
                  >
                    {loading ? "Oluşturuluyor..." : "Kabul Oluştur ve Devam Et"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bölüm-2: Araç bilgileri / geçmiş özeti (salt-görüntü) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  Araç Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vehicleInfo ? (
                  <div className="space-y-4">
                    {/* Son kayıtlı km — vurgulu referans */}
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                      <Gauge className="h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <div className="text-xs text-muted-foreground">Son kayıtlı kilometre</div>
                        <div className="text-lg font-semibold tabular-nums">
                          {vehicleInfo.mileage != null
                            ? `${vehicleInfo.mileage.toLocaleString("tr-TR")} km`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <InfoRow label="Plaka" value={vehicleInfo.plate} />
                      <InfoRow label="Marka / Model" value={`${vehicleInfo.brand} ${vehicleInfo.model}`.trim()} />
                      <InfoRow label="Model Yılı" value={vehicleInfo.modelYear != null ? String(vehicleInfo.modelYear) : null} />
                      <InfoRow label="Yakıt" value={vehicleInfo.fuelType} />
                      <InfoRow label="Vites" value={vehicleInfo.transmission} />
                      <InfoRow label="Renk" value={vehicleInfo.color} />
                      <InfoRow label="İlk Tescil" value={vehicleInfo.firstRegistrationDate} />
                      <InfoRow label="Muayene Geçerlilik" value={vehicleInfo.inspectionValidUntil} />
                      <InfoRow label="Şasi (VIN)" value={vehicleInfo.vin} className="col-span-2" />
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Araç bilgileri yükleniyor…</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Photos — kabul oluşturulduktan sonra mount'lu kalır; Adım 3'e
            geri dönünce `hidden` ile gizlenir (unmount edilmez) ki PhotoAnnotate'in
            yerel önizleme state'i + blob URL'leri kaybolmasın. */}
        {intakeId && (
          <Card className={step === 4 ? undefined : "hidden"}>
            <CardHeader><CardTitle>Fotoğraf & Hasar İşaretleme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {hasFeature((planTier ?? "pro") as PlanTier, "damageMap") && (
                <DamageCapture
                  intakeFormId={intakeId}
                  vehicle={vehicleInfo ? { plate: vehicleInfo.plate, brand: vehicleInfo.brand, model: vehicleInfo.model } : null}
                />
              )}
              {hasFeature((planTier ?? "pro") as PlanTier, "photoChecklist") && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="font-medium">Hasar fotoğrafları</h3>
                    <p className="mb-3 text-sm text-muted-foreground">Hasarı yakından çekin. Yükleme başarısız olursa fotoğrafı yeniden seçip tekrar deneyebilirsiniz.</p>
                  </div>
                  <PhotoAnnotate intakeFormId={intakeId} />
                </>
              )}
              {!hasFeature((planTier ?? "pro") as PlanTier, "damageMap") &&
               !hasFeature((planTier ?? "pro") as PlanTier, "photoChecklist") && (
                <p className="text-sm text-muted-foreground">
                  Hasar işaretleme ve fotoğraf annotation özellikleri paketinizde bulunmuyor. Paketinizi yükselterek bu özelliklere erişebilirsiniz.
                </p>
              )}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="lg">
                  Geri
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="lg" className="gap-2" onClick={handleSaveAndNew}>
                    <Plus className="size-4" /> Kaydet & Yeni
                  </Button>
                  <Button size="lg" className="gap-2" asChild>
                    <Link href={orderId ? `/orders/${orderId}` : "/orders"}>
                      İş Emrine Git
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        </div>
      </div>
    </Form>
  )
}

// Araç bilgi kartındaki tek satır (etiket + değer). Değer boşsa "—" gösterir.
function InfoRow({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value?.trim() ? value : "—"}</dd>
    </div>
  )
}
