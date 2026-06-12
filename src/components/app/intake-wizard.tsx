"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, ChevronRight, User, Car, ClipboardList, Camera, AlertTriangle, MessageSquare } from "lucide-react"

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
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newPhone, setNewPhone] = useState("")

  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [newVehicleMode, setNewVehicleMode] = useState(false)
  const [newPlate, setNewPlate] = useState("")
  const [newBrand, setNewBrand] = useState("")
  const [newModel, setNewModel] = useState("")
  const [newMileage, setNewMileage] = useState("")

  const [mileageAtIntake, setMileageAtIntake] = useState("")
  const [customerComplaint, setCustomerComplaint] = useState("")
  const [internalNote, setInternalNote] = useState("")

  const [intakeId, setIntakeId] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalVerified, setApprovalVerified] = useState(false)
  const [shareToken, setShareToken] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [serviceInfoAccepted, setServiceInfoAccepted] = useState(false)
  const [promoAccepted, setPromoAccepted] = useState(false)

  // Step completion tracking
  const completedSteps = new Set<number>()
  if (selectedCustomerId) completedSteps.add(1)
  if (selectedVehicleId) completedSteps.add(2)
  if (customerComplaint.trim()) completedSteps.add(3)

  useEffect(() => {
    if (selectedCustomerId && !newCustomerMode) {
      fetch(`/api/vehicles?customerId=${selectedCustomerId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setVehicles(data)
        })
    }
  }, [selectedCustomerId, newCustomerMode])

  // Prefill customer/vehicle from OCR redirect
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefillCustomerId && customers.find((c) => c.id === prefillCustomerId)) {
      setSelectedCustomerId(prefillCustomerId)
    }
  }, [prefillCustomerId, customers])

  useEffect(() => {
    if (prefillVehicleId && vehicles.find((v) => v.id === prefillVehicleId)) {
      setSelectedVehicleId(prefillVehicleId)
      if (source === "registration") setStep(3)
    }
  }, [prefillVehicleId, vehicles, source])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleCreateCustomer() {
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("firstName", newFirstName)
      formData.set("lastName", newLastName)
      formData.set("phone", newPhone)
      const res = await fetch("/api/customers", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success && data.id) {
        const fullName = `${newFirstName} ${newLastName}`.trim()
        const newC: Customer = {
          id: data.id,
          firstName: newFirstName,
          lastName: newLastName,
          fullName,
          companyName: null,
          type: "individual",
          phone: newPhone,
        }
        setCustomers((prev) => [...prev, newC])
        setSelectedCustomerId(data.id)
        setNewCustomerMode(false)
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
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("customerId", selectedCustomerId)
      formData.set("plate", newPlate)
      formData.set("brand", newBrand)
      formData.set("model", newModel)
      if (newMileage) formData.set("mileage", newMileage)
      const res = await fetch("/api/vehicles", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success && data.id) {
        const newV: Vehicle = {
          id: data.id,
          plate: newPlate.toUpperCase(),
          brand: newBrand,
          model: newModel,
          customerId: selectedCustomerId,
        }
        setVehicles((prev) => [...prev, newV])
        setSelectedVehicleId(data.id)
        setNewVehicleMode(false)
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
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("customerId", selectedCustomerId)
      formData.set("vehicleId", selectedVehicleId)
      formData.set("customerComplaint", customerComplaint)
      if (mileageAtIntake) formData.set("mileageAtIntake", mileageAtIntake)
      if (internalNote) formData.set("internalNote", internalNote)

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

  function canProceedFrom(stepNum: number): boolean {
    if (stepNum === 1) return !!selectedCustomerId
    if (stepNum === 2) return !!selectedVehicleId
    if (stepNum === 3) return !!customerComplaint.trim()
    return true
  }

  return (
    <div className="space-y-6">
      {source === "registration" && selectedCustomerId && selectedVehicleId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
          <Check className="size-4 shrink-0 mt-0.5" />
          <span>Ruhsattan kaydedilen müşteri ve araç seçildi. Kabul detaylarından devam edin.</span>
        </div>
      )}
      {/* Progress indicator */}
      <div className="bg-card border rounded-xl p-4">
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
                  isComplete ? "bg-green-500" : isCurrent ? "bg-primary" : isPast ? "bg-primary/30" : "bg-muted"
                }`}
              />
            )
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Customer */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>1. Müşteri Seçimi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!newCustomerMode ? (
              <div className="space-y-3">
                <Label>Mevcut Müşteri</Label>
                <Select value={selectedCustomerId} onValueChange={(v) => setSelectedCustomerId(v || "")}>
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue placeholder="Müşteri seçiniz..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.type === "corporate"
                          ? c.companyName || "Kurumsal Müşteri"
                          : c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full h-12" onClick={() => setNewCustomerMode(true)}>
                  + Yeni Müşteri Oluştur
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ad *</Label>
                    <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="Ahmet" required className="h-12" />
                  </div>
                  <div>
                    <Label>Soyad *</Label>
                    <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Yılmaz" required className="h-12" />
                  </div>
                </div>
                <div>
                  <Label>Telefon *</Label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" placeholder="0555 123 4567" required className="h-12" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateCustomer} disabled={loading || !newFirstName || !newLastName || !newPhone} className="h-12 flex-1">
                    {loading ? "Oluşturuluyor..." : "Müşteri Oluştur"}
                  </Button>
                  <Button variant="outline" onClick={() => setNewCustomerMode(false)} className="h-12">
                    İptal
                  </Button>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedFrom(1)} size="lg" className="h-12 gap-2">
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
                <Label>Mevcut Araç</Label>
                {vehicles.length === 0 && !loading ? (
                  <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                    Bu müşteriye ait araç bulunamadı. Yeni araç oluşturun.
                  </div>
                ) : (
                  <Select value={selectedVehicleId} onValueChange={(v) => setSelectedVehicleId(v || "")}>
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder="Araç seçiniz..." />
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
                <Button variant="outline" className="w-full h-12" onClick={() => setNewVehicleMode(true)}>
                  + Yeni Araç Oluştur
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Plaka *</Label>
                  <Input value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="34 ABC 123" required className="h-12" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Marka *</Label>
                    <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Toyota" required className="h-12" />
                  </div>
                  <div>
                    <Label>Model *</Label>
                    <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Corolla" required className="h-12" />
                  </div>
                </div>
                <div>
                  <Label>Kilometre</Label>
                  <Input value={newMileage} onChange={(e) => setNewMileage(e.target.value)} type="number" placeholder="50000" className="h-12" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateVehicle} disabled={loading || !newPlate || !newBrand || !newModel} className="h-12 flex-1">
                    {loading ? "Oluşturuluyor..." : "Araç Oluştur"}
                  </Button>
                  <Button variant="outline" onClick={() => setNewVehicleMode(false)} className="h-12">
                    İptal
                  </Button>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} size="lg" className="h-12">
                Geri
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedFrom(2)} size="lg" className="h-12 gap-2">
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
            <div>
              <Label>Kilometre</Label>
              <Input value={mileageAtIntake} onChange={(e) => setMileageAtIntake(e.target.value)} type="number" placeholder="50000" className="h-12" />
            </div>
            <div>
              <Label>Müşteri Şikayeti *</Label>
              <Textarea
                value={customerComplaint}
                onChange={(e) => setCustomerComplaint(e.target.value)}
                placeholder="Müşterinin şikayetini detaylı olarak yazınız..."
                required
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label>İç Not</Label>
              <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-[80px]" />
            </div>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} size="lg" className="h-12">
                Geri
              </Button>
              <Button onClick={handleCreateIntake} disabled={loading || !canProceedFrom(3)} size="lg" className="h-12 gap-2">
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
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-start gap-2">
              <Camera className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Fotoğraflar kabul oluşturulduktan sonra eklenir</p>
                <p className="mt-1 text-blue-600">
                  Araç fotoğrafları, hasar tespiti ve onay süreci için önemlidir. Bir sonraki adıma geçin, fotoğrafları kabul detay sayfasından ekleyebilirsiniz.
                </p>
              </div>
            </div>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} size="lg" className="h-12">
                Geri
              </Button>
              <Button onClick={() => setStep(5)} size="lg" className="h-12 gap-2">
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
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Hasarlar kabul oluşturulduktan sonra işaretlenir</p>
                <p className="mt-1 text-blue-600">
                  Araç üzerindeki hasarları kabul detay sayfasından interaktif araç haritası üzerinde işaretleyebilirsiniz.
                </p>
              </div>
            </div>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)} size="lg" className="h-12">
                Geri
              </Button>
              <Button onClick={() => setStep(6)} size="lg" className="h-12 gap-2">
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
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                  <p className="font-medium mb-1">Demo Modu</p>
                  <p>Demo modunda SMS gönderilmez. Test kodu ekranda gösterilir. Gerçek SMS entegrasyonu sonraki sürümlerde eklenecektir.</p>
                </div>

                <div className="space-y-3 border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-medium">Onay Gereksinimleri</p>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor="terms" className="text-sm">
                      Araç kabul formunu onaylıyorum. <span className="text-destructive">*</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="privacy"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor="privacy" className="text-sm">
                      Aydınlatma metnini okudum. <span className="text-destructive">*</span>
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="serviceInfo"
                      checked={serviceInfoAccepted}
                      onChange={(e) => setServiceInfoAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor="serviceInfo" className="text-sm text-muted-foreground">
                      Servis süreciyle ilgili bilgilendirme almak istiyorum.
                    </label>
                  </div>

                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="promo"
                      checked={promoAccepted}
                      onChange={(e) => setPromoAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor="promo" className="text-sm text-muted-foreground">
                      Kampanya ve ticari ileti almak istiyorum.
                    </label>
                  </div>
                </div>

                <Button onClick={handleRequestApproval} disabled={loading || !termsAccepted || !privacyAccepted} size="lg" className="w-full h-12">
                  {loading ? "Gönderiliyor..." : "Onay Talebi Oluştur"}
                </Button>
              </div>
            )}

            {approvalSent && generatedOtp && !approvalVerified && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-green-50 border-2 border-green-200 text-green-800 text-center">
                  <p className="text-sm font-medium mb-2">Demo Test Kodu</p>
                  <p className="text-4xl font-bold tracking-[0.3em]">{generatedOtp}</p>
                  <p className="text-xs mt-2 text-green-600">Bu kodu müşteriye göstererek onay alabilirsiniz</p>
                </div>
                <div className="space-y-2">
                  <Label>Onay Kodu</Label>
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 haneli kodu giriniz"
                    maxLength={6}
                    className="h-14 text-center text-2xl tracking-widest"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length < 4} size="lg" className="w-full h-12">
                  {loading ? "Doğrulanıyor..." : "Onay Kodunu Doğrula"}
                </Button>
              </div>
            )}

            {approvalVerified && !shareToken && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
                  <Check className="size-5" />
                  Müşteri onayı başarıyla doğrulandı.
                </div>
                <Button onClick={handleGenerateShareLink} disabled={loading} size="lg" className="w-full h-12">
                  Müşteri Çıktı Linki Oluştur
                </Button>
              </div>
            )}

            {shareToken && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                  <p className="font-medium">Müşteri çıktı linki oluşturuldu</p>
                </div>
                <div className="p-4 bg-muted rounded-xl break-all text-sm border">
                  <p className="text-xs text-muted-foreground mb-1">Paylaşım linki:</p>
                  <code className="text-primary">
                    {typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => router.push(`/app/intakes/${intakeId}`)} size="lg" className="flex-1 h-12">
                    Kabul Detayına Git
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-start">
              <Button variant="outline" onClick={() => setStep(5)} size="lg" className="h-12">
                Geri
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
