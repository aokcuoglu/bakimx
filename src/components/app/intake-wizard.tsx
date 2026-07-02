"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, ChevronRight, User, ClipboardList, Camera } from "lucide-react"
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
import { CustomerVehiclePicker } from "./customer-vehicle-picker"
import { PhotoAnnotate } from "./photo-annotate"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
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

  const [intakeId, setIntakeId] = useState("")
  const [orderId, setOrderId] = useState("")

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

  // Seçili aracın güncel km'sini Kilometre alanına ön-doldur (kullanıcı girdisini ezme).
  useEffect(() => {
    if (!selectedVehicleId || form.getValues("mileageAtIntake")) return
    let active = true
    fetch(`/api/vehicles/${selectedVehicleId}`)
      .then((r) => r.json())
      .then((v: unknown) => {
        if (!active || !v || typeof v !== "object") return
        const km = (v as { mileage?: number | null }).mileage
        if (km != null && !form.getValues("mileageAtIntake")) {
          form.setValue("mileageAtIntake", String(km))
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [selectedVehicleId, form])

  async function handleCreateIntake() {
    const valid = await form.trigger(["customerComplaint"])
    if (!valid) return
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

        {/* Step 3: Intake details */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Kabul Detayları</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="mileageAtIntake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilometre</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="50000" />
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
                <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg">
                  Geri
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateIntake}
                  disabled={loading || !customerComplaint.trim()}
                  size="lg"
                  className="gap-2"
                >
                  {loading ? "Oluşturuluyor..." : "Kabul Oluştur ve Devam Et"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Photos — kabul oluşturulduktan sonra mount'lu kalır; Adım 3'e
            geri dönünce `hidden` ile gizlenir (unmount edilmez) ki PhotoAnnotate'in
            yerel önizleme state'i + blob URL'leri kaybolmasın. */}
        {intakeId && (
          <Card className={step === 4 ? undefined : "hidden"}>
            <CardHeader><CardTitle>Fotoğraf & Hasar İşaretleme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <PhotoAnnotate intakeFormId={intakeId} />
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="lg">
                  Geri
                </Button>
                <Button nativeButton={false} size="lg" className="gap-2" render={<Link href={orderId ? `/orders/${orderId}` : "/orders"} />}>
                  İş Emrine Git
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </Form>
  )
}
