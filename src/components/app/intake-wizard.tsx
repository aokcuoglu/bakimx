"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Customer = { id: string; firstName: string; lastName: string; phone: string }
type Vehicle = { id: string; plate: string; brand: string; model: string; customerId: string }

const STEPS = [
  { id: 1, label: "Müşteri" },
  { id: 2, label: "Araç" },
  { id: 3, label: "Araç Kabul" },
  { id: 4, label: "Fotoğraflar" },
  { id: 5, label: "Hasar" },
  { id: 6, label: "Onay" },
]

export function IntakeWizard({ customers: initialCustomers }: { customers: Customer[] }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState(initialCustomers)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  // Step 1: Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newPhone, setNewPhone] = useState("")

  // Step 2: Vehicle selection
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [newVehicleMode, setNewVehicleMode] = useState(false)
  const [newPlate, setNewPlate] = useState("")
  const [newBrand, setNewBrand] = useState("")
  const [newModel, setNewModel] = useState("")
  const [newMileage, setNewMileage] = useState("")

  // Step 3: Intake details
  const [mileageAtIntake, setMileageAtIntake] = useState("")
  const [customerComplaint, setCustomerComplaint] = useState("")
  const [internalNote, setInternalNote] = useState("")

  // Step 6: Approval
  const [intakeId, setIntakeId] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState("")
  const [approvalSent, setApprovalSent] = useState(false)
  const [approvalVerified, setApprovalVerified] = useState(false)
  const [shareToken, setShareToken] = useState("")

  useEffect(() => {
    if (selectedCustomerId && !newCustomerMode) {
      fetch(`/api/vehicles?customerId=${selectedCustomerId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setVehicles(data)
        })
    }
  }, [selectedCustomerId, newCustomerMode])

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
        const newC: Customer = { id: data.id, firstName: newFirstName, lastName: newLastName, phone: newPhone }
        setCustomers((prev) => [...prev, newC])
        setSelectedCustomerId(data.id)
        setNewCustomerMode(false)
      } else {
        setError(data.error || "Müşteri oluşturulamadı")
      }
    } catch {
      setError("Bir hata oluştu")
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
      setError("Bir hata oluştu")
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
      setError("Bir hata oluştu")
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
      setError("Bir hata oluştu")
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
      setError("Bir hata oluştu")
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
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  function canProceedToStep2() {
    return !!selectedCustomerId
  }

  function canProceedToStep3() {
    return !!selectedVehicleId
  }

  function canCreateIntake() {
    return !!customerComplaint.trim()
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              if (s.id < step || (s.id === step + 1 && canProceed())) setStep(s.id)
            }}
            className={`flex-1 text-center text-xs font-medium pb-1 border-b-2 transition-colors ${
              s.id === step
                ? "text-primary border-primary"
                : s.id < step
                ? "text-green-600 border-green-600"
                : "text-muted-foreground border-border"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Step 1: Customer */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Müşteri Seçimi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!newCustomerMode ? (
              <div className="space-y-3">
                <Label>Mevcut Müşteri</Label>
                <Select value={selectedCustomerId} onValueChange={(v) => setSelectedCustomerId(v || "")}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Müşteri seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full" onClick={() => setNewCustomerMode(true)}>
                  + Yeni Müşteri Oluştur
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ad *</Label><Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required /></div>
                  <div><Label>Soyad *</Label><Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required /></div>
                </div>
                <div><Label>Telefon *</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" required /></div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateCustomer} disabled={loading || !newFirstName || !newLastName || !newPhone}>
                    {loading ? "Oluşturuluyor..." : "Müşteri Oluştur"}
                  </Button>
                  <Button variant="outline" onClick={() => setNewCustomerMode(false)}>İptal</Button>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedToStep2()}>
                Devam
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Vehicle */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Araç Seçimi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!newVehicleMode ? (
              <div className="space-y-3">
                <Label>Mevcut Araç</Label>
                <Select value={selectedVehicleId} onValueChange={(v) => setSelectedVehicleId(v || "")}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Araç seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} - {v.brand} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full" onClick={() => setNewVehicleMode(true)}>
                  + Yeni Araç Oluştur
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div><Label>Plaka *</Label><Input value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="34 ABC 123" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Marka *</Label><Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Toyota" required /></div>
                  <div><Label>Model *</Label><Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Corolla" required /></div>
                </div>
                <div><Label>Kilometre</Label><Input value={newMileage} onChange={(e) => setNewMileage(e.target.value)} type="number" placeholder="50000" /></div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateVehicle} disabled={loading || !newPlate || !newBrand || !newModel}>
                    {loading ? "Oluşturuluyor..." : "Araç Oluştur"}
                  </Button>
                  <Button variant="outline" onClick={() => setNewVehicleMode(false)}>İptal</Button>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Geri</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedToStep3()}>Devam</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Intake details */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Kabul Detayları</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Kilometre</Label><Input value={mileageAtIntake} onChange={(e) => setMileageAtIntake(e.target.value)} type="number" placeholder="50000" /></div>
            <div><Label>Müşteri Şikayeti *</Label><Textarea value={customerComplaint} onChange={(e) => setCustomerComplaint(e.target.value)} placeholder="Müşterinin şikayetini yazın..." required /></div>
            <div><Label>İç Not</Label><Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Servis içi notlar..." /></div>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Geri</Button>
              <Button onClick={handleCreateIntake} disabled={loading || !canCreateIntake()}>
                {loading ? "Oluşturuluyor..." : "Kabul Oluştur ve Devam Et"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Photos */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Fotoğraf Kontrolü</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Araç fotoğrafları, hasar tespiti için önemlidir. Fotoğrafları kabul detay sayfasından ekleyebilirsiniz.
            </p>
            <p className="text-sm text-muted-foreground">
              Bu adımı şimdilik atlayıp, kabul oluşturulduktan sonra fotoğraf ekleyebilirsiniz.
            </p>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Geri</Button>
              <Button onClick={() => setStep(5)}>Devam</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Damage marking */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle>Hasar İşaretleme</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Araç hasarlarını kabul detay sayfasından işaretleyebilirsiniz. Bu adımı şimdilik atlayıp daha sonra da ekleyebilirsiniz.
            </p>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>Geri</Button>
              <Button onClick={() => setStep(6)}>Devam</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Approval */}
      {step === 6 && (
        <Card>
          <CardHeader><CardTitle>Onay Süreci</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!approvalSent && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Müşteriye SMS ile onay kodu gönderilecek. Demo modunda SMS gönderilmez, kod ekranda gösterilir.
                </p>
                <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                  Demo modunda SMS gönderilmez. Test kodu ekranda gösterilir.
                </div>
                <Button onClick={handleRequestApproval} disabled={loading} className="w-full">
                  {loading ? "Gönderiliyor..." : "Onay Talebi Oluştur"}
                </Button>
              </div>
            )}

            {approvalSent && generatedOtp && !approvalVerified && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-green-50 text-green-800 text-center">
                  <p className="text-sm">Onay kodu (demo):</p>
                  <p className="text-3xl font-bold tracking-widest mt-1">{generatedOtp}</p>
                </div>
                <div className="space-y-2">
                  <Label>Onay Kodu</Label>
                  <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" />
                </div>
                <Button onClick={handleVerifyOtp} disabled={loading || !otpCode} className="w-full">
                  {loading ? "Doğrulanıyor..." : "Onay Kodunu Doğrula"}
                </Button>
              </div>
            )}

            {approvalVerified && !shareToken && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">
                  Müşteri onayı başarıyla doğrulandı.
                </div>
                <Button onClick={handleGenerateShareLink} disabled={loading} className="w-full">
                  Müşteri Çıktı Linki Oluştur
                </Button>
              </div>
            )}

            {shareToken && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">
                  Müşteri çıktı linki oluşturuldu.
                </div>
                <div className="p-3 bg-muted rounded-lg break-all text-sm">
                  {typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => router.push(`/app/intakes/${intakeId}`)} className="w-full">
                    Kabul Detayına Git
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-start">
              <Button variant="outline" onClick={() => setStep(5)}>Geri</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  function canProceed() {
    if (step === 1) return canProceedToStep2()
    if (step === 2) return canProceedToStep3()
    return true
  }
}