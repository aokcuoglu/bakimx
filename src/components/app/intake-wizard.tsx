"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, ChevronRight, User, Car, ClipboardList, Camera, AlertTriangle, MessageSquare, Info } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { intakeSchema, type IntakeFormValues } from "@/lib/validations/intake"
import { typedResolver } from "@/lib/validations/resolver"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}
type Vehicle = { id: string; plate: string; brand: string; model: string; customerId: string }

const STEPS = [
  { id: 1, label: "Müşteri", icon: User },
  { id: 2, label: "Araç", icon: Car },
  { id: 3, label: "Kabul", icon: ClipboardList },
  { id: 4, label: "Fotoğraf", icon: Camera },
  { id: 5, label: "Hasar", icon: AlertTriangle },
  { id: 6, label: "Onay", icon: MessageSquare },
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
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newVehicleMode, setNewVehicleMode] = useState(false)

  const [intakeId, setIntakeId] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalVerified, setApprovalVerified] = useState(false)
  const [shareToken, setShareToken] = useState("")

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
  const termsAccepted = form.watch("termsAccepted")
  const privacyAccepted = form.watch("privacyAccepted")
  const otpCode = form.watch("otpCode")

  // Step completion tracking
  const completedSteps = new Set<number>()
  if (selectedCustomerId) completedSteps.add(1)
  if (selectedVehicleId) completedSteps.add(2)
  if (customerComplaint.trim()) completedSteps.add(3)

  useEffect(() => {
    if (selectedCustomerId && !newCustomerMode) {
      setVehicleLoading(true)
      fetch(`/api/vehicles?customerId=${selectedCustomerId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setVehicles(data)
        })
        .catch(() => setVehicles([]))
        .finally(() => setVehicleLoading(false))
    }
  }, [selectedCustomerId, newCustomerMode])

  // Prefill customer/vehicle from OCR redirect
  useEffect(() => {
    if (prefillCustomerId && customers.find((c) => c.id === prefillCustomerId)) {
      form.setValue("selectedCustomerId", prefillCustomerId)
    }
  }, [prefillCustomerId, customers, form])

  useEffect(() => {
    if (prefillVehicleId && vehicles.find((v) => v.id === prefillVehicleId)) {
      form.setValue("selectedVehicleId", prefillVehicleId)
      if (source === "registration") setStep(3)
    }
  }, [prefillVehicleId, vehicles, source, form])

  async function handleCreateCustomer() {
    const valid = await form.trigger(["newFirstName", "newLastName", "newPhone"])
    if (!valid) return
    const values = form.getValues()
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("firstName", values.newFirstName)
      formData.set("lastName", values.newLastName)
      formData.set("phone", values.newPhone)
      const res = await fetch("/api/customers", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success && data.id) {
        const fullName = `${values.newFirstName} ${values.newLastName}`.trim()
        const newC: Customer = {
          id: data.id,
          firstName: values.newFirstName,
          lastName: values.newLastName,
          fullName,
          companyName: null,
          type: "individual",
          phone: values.newPhone,
        }
        setCustomers((prev) => [...prev, newC])
        form.setValue("selectedCustomerId", data.id)
        setNewCustomerMode(false)
        toast.success("Müşteri oluşturuldu")
      } else {
        setError(data.error || "Müşteri oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVehicle() {
    const values = form.getValues()
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("customerId", values.selectedCustomerId)
      formData.set("plate", values.newPlate)
      formData.set("brand", values.newBrand)
      formData.set("model", values.newModel)
      if (values.newMileage) formData.set("mileage", values.newMileage)
      const res = await fetch("/api/vehicles", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success && data.id) {
        const newV: Vehicle = {
          id: data.id,
          plate: values.newPlate.toUpperCase(),
          brand: values.newBrand,
          model: values.newModel,
          customerId: values.selectedCustomerId,
        }
        setVehicles((prev) => [...prev, newV])
        form.setValue("selectedVehicleId", data.id)
        setNewVehicleMode(false)
        toast.success("Araç oluşturuldu")
      } else {
        setError(data.error || "Araç oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateIntake() {
    const valid = await form.trigger(["customerComplaint"])
    if (!valid) return
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

  async function handleRequestApproval() {
    const valid = await form.trigger(["termsAccepted", "privacyAccepted"])
    if (!valid) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intakeId}/approval`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setGeneratedOtp(data.otpCode)
        setApprovalSent(true)
      } else {
        setError(data.error || "Onay talebi oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intakeId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode }),
      })
      const data = await res.json()
      if (data.success) {
        setApprovalVerified(true)
        toast.success("Müşteri onayı doğrulandı")
      } else {
        setError(data.error || "Doğrulama başarısız")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateShareLink() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intakeId}/share`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setShareToken(data.token)
      } else {
        setError(data.error || "Link oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyiniz")
    } finally {
      setLoading(false)
    }
  }

  async function nextStep(fields: (keyof IntakeFormValues)[]) {
    const valid = await form.trigger(fields)
    if (valid) setStep(step + 1)
  }

  function customerLabel(c: Customer): string {
    if (c.type === "corporate") return c.companyName || "Kurumsal Müşteri"
    return c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"
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
              Adım {step} / {STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {STEPS[step - 1]?.label}
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
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Customer */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>1. Müşteri Seçimi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!newCustomerMode ? (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="selectedCustomerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mevcut Müşteri</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                            <SelectTrigger className="w-full h-12 text-base">
                              <SelectValue placeholder="Müşteri seçiniz...">
                                {(value: string | null) => {
                                  if (!value) return null
                                  const c = customers.find((x) => x.id === value)
                                  if (!c) return value
                                  return `${customerLabel(c)} - ${c.phone}`
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {customerLabel(c)} - {c.phone}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button variant="outline" className="w-full h-12" onClick={() => setNewCustomerMode(true)}>
                    + Yeni Müşteri Oluştur
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="newFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ad *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ahmet" className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Soyad *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Yılmaz" className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="newPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0555 123 4567" className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={async () => {
                        const valid = await form.trigger(["newFirstName", "newLastName", "newPhone"])
                        if (valid) handleCreateCustomer()
                      }}
                      disabled={loading}
                      className="h-12 flex-1"
                    >
                      {loading ? "Oluşturuluyor..." : "Müşteri Oluştur"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setNewCustomerMode(false)} className="h-12">
                      İptal
                    </Button>
                  </div>
                </div>
              )}
              <div className="pt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => nextStep(["selectedCustomerId"])}
                  disabled={!selectedCustomerId}
                  size="lg"
                  className="h-12 gap-2"
                >
                  Devam <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Vehicle */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>2. Araç Seçimi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!newVehicleMode ? (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="selectedVehicleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mevcut Araç</FormLabel>
                        <FormControl>
                          {vehicles.length === 0 && !vehicleLoading ? (
                            <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                              Bu müşteriye ait araç bulunamadı. Yeni araç oluşturun.
                            </div>
                          ) : (
                            <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                              <SelectTrigger className="w-full h-12 text-base">
                                <SelectValue placeholder={vehicleLoading ? "Yükleniyor..." : "Araç seçiniz..."}>
                                  {(value: string | null) => {
                                    if (!value) return null
                                    const v = vehicles.find((x) => x.id === value)
                                    if (!v) return value
                                    return `${v.plate} - ${v.brand} ${v.model}`
                                  }}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {vehicles.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.plate} - {v.brand} {v.model}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button variant="outline" className="w-full h-12" onClick={() => setNewVehicleMode(true)}>
                    + Yeni Araç Oluştur
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="newPlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plaka *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="34 ABC 123" className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="newBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marka *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Toyota" className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Corolla" className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="newMileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kilometre</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="50000" className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={async () => {
                        const valid = await form.trigger(["newPlate", "newBrand", "newModel"])
                        if (valid) handleCreateVehicle()
                      }}
                      disabled={loading}
                      className="h-12 flex-1"
                    >
                      {loading ? "Oluşturuluyor..." : "Araç Oluştur"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setNewVehicleMode(false)} className="h-12">
                      İptal
                    </Button>
                  </div>
                </div>
              )}
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg" className="h-12">
                  Geri
                </Button>
                <Button
                  type="button"
                  onClick={() => nextStep(["selectedVehicleId"])}
                  disabled={!selectedVehicleId}
                  size="lg"
                  className="h-12 gap-2"
                >
                  Devam <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Intake details */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>3. Kabul Detayları</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="mileageAtIntake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilometre</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="50000" className="h-12" />
                    </FormControl>
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
                <Button type="button" variant="outline" onClick={() => setStep(2)} size="lg" className="h-12">
                  Geri
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateIntake}
                  disabled={loading || !customerComplaint.trim()}
                  size="lg"
                  className="h-12 gap-2"
                >
                  {loading ? "Oluşturuluyor..." : "Kabul Oluştur ve Devam Et"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Photos */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>4. Fotoğraf Kontrolü</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5 text-primary">
                <Camera className="size-4" />
                <AlertTitle>Fotoğraflar kabul oluşturulduktan sonra eklenir</AlertTitle>
                <AlertDescription>
                  Araç fotoğrafları, hasar tespiti ve onay süreci için önemlidir. Bir sonraki adıma geçin, fotoğrafları kabul detay sayfasından ekleyebilirsiniz.
                </AlertDescription>
              </Alert>
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="lg" className="h-12">
                  Geri
                </Button>
                <Button type="button" onClick={() => setStep(5)} size="lg" className="h-12 gap-2">
                  Devam <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Damage marking */}
        {step === 5 && (
          <Card>
            <CardHeader><CardTitle>5. Hasar İşaretleme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5 text-primary">
                <AlertTriangle className="size-4" />
                <AlertTitle>Hasarlar kabul oluşturulduktan sonra işaretlenir</AlertTitle>
                <AlertDescription>
                  Araç üzerindeki hasarları kabul detay sayfasından interaktif araç haritası üzerinde işaretleyebilirsiniz.
                </AlertDescription>
              </Alert>
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(4)} size="lg" className="h-12">
                  Geri
                </Button>
                <Button type="button" onClick={() => setStep(6)} size="lg" className="h-12 gap-2">
                  Devam <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Approval */}
        {step === 6 && (
          <Card>
            <CardHeader><CardTitle>6. Onay Süreci</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!approvalSent && (
                <div className="space-y-4">
                  <Alert className="border-warning/30 bg-warning/5 text-warning">
                    <Info className="size-4" />
                    <AlertTitle>Demo Modu</AlertTitle>
                    <AlertDescription>Demo modunda SMS gönderilmez. Test kodu ekranda gösterilir. Gerçek SMS entegrasyonu sonraki sürümlerde eklenecektir.</AlertDescription>
                  </Alert>

                  <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                    <p className="text-sm font-medium">Onay Gereksinimleri</p>

                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(c) => field.onChange(c)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div className="space-y-0.5 leading-none">
                            <FormLabel className="text-sm font-normal">
                              Araç kabul formunu onaylıyorum. <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="privacyAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(c) => field.onChange(c)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div className="space-y-0.5 leading-none">
                            <FormLabel className="text-sm font-normal">
                              Aydınlatma metnini okudum. <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serviceInfoAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(c) => field.onChange(c)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div className="space-y-0.5 leading-none">
                            <FormLabel className="text-sm font-normal text-muted-foreground">
                              Servis süreciyle ilgili bilgilendirme almak istiyorum.
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="promoAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(c) => field.onChange(c)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div className="space-y-0.5 leading-none">
                            <FormLabel className="text-sm font-normal text-muted-foreground">
                              Kampanya ve ticari ileti almak istiyorum.
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleRequestApproval}
                    disabled={loading || !termsAccepted || !privacyAccepted}
                    size="lg"
                    className="w-full h-12"
                  >
                    {loading ? "Gönderiliyor..." : "Onay Talebi Oluştur"}
                  </Button>
                </div>
              )}

              {approvalSent && generatedOtp && !approvalVerified && (
                <div className="space-y-4">
                  <div className="p-5 rounded-lg border-2 border-primary/30 bg-primary/5 text-primary text-center">
                    <p className="text-sm font-medium mb-2">Demo Test Kodu</p>
                    <p className="text-4xl font-bold tracking-[0.3em]">{generatedOtp}</p>
                    <p className="text-xs mt-2 text-primary/70">Bu kodu müşteriye göstererek onay alabilirsiniz</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="otpCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Onay Kodu</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value.replace(/\D/g, "").slice(0, 6)}
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="6 haneli kodu giriniz"
                            maxLength={6}
                            className="h-14 text-center text-2xl tracking-widest"
                            inputMode="numeric"
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length < 4}
                    size="lg"
                    className="w-full h-12"
                  >
                    {loading ? "Doğrulanıyor..." : "Onay Kodunu Doğrula"}
                  </Button>
                </div>
              )}

              {approvalVerified && !shareToken && (
                <div className="space-y-4">
                  <Alert className="border-primary/30 bg-primary/5 text-primary">
                    <Check className="size-4" />
                    <AlertDescription>Müşteri onayı başarıyla doğrulandı.</AlertDescription>
                  </Alert>
                  <Button
                    type="button"
                    onClick={handleGenerateShareLink}
                    disabled={loading}
                    size="lg"
                    className="w-full h-12"
                  >
                    Müşteri Çıktı Linki Oluştur
                  </Button>
                </div>
              )}

              {shareToken && (
                <div className="space-y-4">
                  <Alert className="border-primary/30 bg-primary/5 text-primary">
                    <AlertDescription>Müşteri çıktı linki oluşturuldu</AlertDescription>
                  </Alert>
                  <div className="p-4 bg-muted rounded-lg break-all text-sm border">
                    <p className="text-xs text-muted-foreground mb-1">Paylaşım linki:</p>
                    <code className="text-primary">
                      {typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`}
                    </code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      nativeButton={false}
                      size="lg"
                      className="flex-1 h-12"
                      render={<Link href={`/intakes/${intakeId}`} />}
                    >
                      Kabul Detayına Git
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-start">
                <Button type="button" variant="outline" onClick={() => setStep(5)} size="lg" className="h-12">
                  Geri
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Form>
  )
}