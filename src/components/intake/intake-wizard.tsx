"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, ChevronRight, User, ClipboardList, Camera, Car, Gauge, Plus } from "lucide-react"
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
import { CustomerVehiclePicker } from "@/components/intake/customer-vehicle-picker"
import { PhotoAnnotate } from "@/components/intake/photo-annotate"

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
}: {
  customers: Customer[]
  prefillCustomerId?: string
  prefillVehicleId?: string
  source?: string
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
      customerComplaint: "",
      internalNote: "",
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
  // CustomerVehiclePicker'ın zaten var olan rehydrate mekanizmasını besler.
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
      formData.set("internalNote", values.internalNote)

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

  return (
    <Form {...form}>
      <div className="space-y-6">
        {source === "registration" && selectedCustomerId && selectedVehicleId && (
          <Alert className="border-primary/30 bg-primary/5 text-primary">
            <Check className="size-4" />
            <AlertDescription>Ruhsattan kaydedilen müşteri ve araç seçildi. Kabul detaylarından devam edin.</AlertDescription>
          </Alert>
        )}
        {/* Progress indicator */}
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              Adım {STEPS.findIndex((s) => s.id === step) + 1} / {STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {STEPS.find((s) => s.id === step)?.label}
            </span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s) => {
              const isComplete = completedSteps.has(s.id)
              const isCurrent = s.id === step
              const isPast = s.id < step
              return (
                <div
                  key={s.id}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    isComplete ? "bg-primary" : isCurrent ? "bg-primary" : isPast ? "bg-primary/30" : "bg-muted"
                  }`}
                />
              )
            })}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Customer & Vehicle */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Müşteri & Araç</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <CustomerVehiclePicker
                value={{ customerId: selectedCustomerId, vehicleId: selectedVehicleId }}
                onChange={(v) => {
                  form.setValue("selectedCustomerId", v.customerId, { shouldValidate: true })
                  form.setValue("selectedVehicleId", v.vehicleId, { shouldValidate: true })
                  syncSelectionToUrl(v.customerId, v.vehicleId)
                }}
              />
              <div className="pt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedCustomerId || !selectedVehicleId}
                  className="h-11 gap-2 px-5 md:h-9"
                >
                  Devam <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Intake details — iki kolon: sol=servis yetkilisinin girdiği kabul
            detayları, sağ=aracın salt-görüntü geçmiş/bilgi özeti. Mobilde alt alta yığılır
            (araç bilgileri formun altına düşer). */}
        {step === 3 && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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
                        <p className="text-xs text-destructive">
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
              <PhotoAnnotate intakeFormId={intakeId} />
              <div className="pt-4 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="lg">
                  Geri
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="lg" className="gap-2" onClick={handleSaveAndNew}>
                    <Plus className="size-4" /> Kaydet & Yeni
                  </Button>
                  <Button nativeButton={false} size="lg" className="gap-2" render={<Link href={orderId ? `/orders/${orderId}` : "/orders"} />}>
                    İş Emrine Git
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
