"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ChevronDown, Loader2, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "./customer-search-or-create"
import { VehicleBrandModelPicker } from "./vehicle-brand-model-picker"
import { RuhsattanOku, type RuhsattanOkuResult } from "./ruhsattan-oku"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"

export type InlineCreateResult = {
  customerId: string
  vehicleId: string
  plate?: string
  brand?: string
  model?: string
  customerName?: string
}

// Vehicle fields kept in a single state object so both manual entry and OCR
// prefill flow through the same inputs.
type VehicleFields = {
  plate: string
  modelYear: string
  brand: string
  model: string
  vehicleType: string
  commercialName: string
  vin: string
  engineNo: string
  fuelType: string
  engineDisplacement: string
  enginePower: string
  firstRegistrationDate: string
  inspectionValidUntil: string
}

const EMPTY_FIELDS: VehicleFields = {
  plate: "",
  modelYear: "",
  brand: "",
  model: "",
  vehicleType: "",
  commercialName: "",
  vin: "",
  engineNo: "",
  fuelType: "",
  engineDisplacement: "",
  enginePower: "",
  firstRegistrationDate: "",
  inspectionValidUntil: "",
}

export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  fixedCustomer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  fixedCustomer?: { id: string; label: string }
  onCreated: (result: InlineCreateResult) => void
}) {
  const [owner, setOwner] = useState<{ id: string; label: string } | null>(fixedCustomer ?? null)
  const [fields, setFields] = useState<VehicleFields>(EMPTY_FIELDS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Ruhsat scan state. `scannerActive` only tracks whether the full-screen scanner
  // (portal'd to <body>) is up, so the dialog can skip its outside-press/Esc dismissal.
  const [scannerActive, setScannerActive] = useState(false)
  const [ownerSeed, setOwnerSeed] = useState<{
    isCorporate: boolean
    firstName: string
    lastName: string
    companyName: string
    label: string
  } | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number | undefined>>({})
  const [showDetails, setShowDetails] = useState(false)

  function setField(key: keyof VehicleFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  // Reset only on the OPEN transition (false→true), not on every prop change,
  // so the picker clearing its own query mid-session can't wipe typed values.
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase() })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      setShowDetails(false)
    }, 0)
  }, [open, initialPlate, fixedCustomer])

  function applyOcr({ values, confidence: conf, owner }: RuhsattanOkuResult) {
    setFields((prev) => ({
      ...prev,
      plate: values.plate || prev.plate,
      brand: values.brand || prev.brand,
      model: values.model || prev.model,
      vehicleType: values.vehicleType || prev.vehicleType,
      modelYear: values.modelYear || prev.modelYear,
      vin: values.vin || prev.vin,
      engineNo: values.engineNo || prev.engineNo,
      firstRegistrationDate: values.registrationDate || prev.firstRegistrationDate,
      commercialName: values.commercialName || prev.commercialName,
      fuelType: values.fuelType || prev.fuelType,
      engineDisplacement: values.engineDisplacement || prev.engineDisplacement,
      enginePower: values.enginePower || prev.enginePower,
      inspectionValidUntil: values.inspectionValidUntil || prev.inspectionValidUntil,
    }))
    setConfidence({
      plate: conf.plate,
      brand: conf.brand,
      model: conf.model,
      vehicleType: conf.vehicleType,
      modelYear: conf.modelYear,
      vin: conf.vin,
      engineNo: conf.engineNo,
      firstRegistrationDate: conf.registrationDate,
      commercialName: conf.commercialName,
      fuelType: conf.fuelType,
      engineDisplacement: conf.engineDisplacement,
      enginePower: conf.enginePower,
      inspectionValidUntil: conf.inspectionValidUntil,
    })
    if (owner.label) setOwnerSeed(owner)
    setShowDetails(true)
  }

  function lowConf(key: string): boolean {
    const c = confidence[key]
    return c !== undefined && c !== null && c < LOW_CONFIDENCE_THRESHOLD
  }

  function fieldClass(key: string): string {
    return lowConf(key) ? "border-warning/40 bg-warning/10 focus-visible:border-warning" : ""
  }

  async function handleCreate(edit: boolean) {
    setError("")
    if (!owner) { setError("Önce müşteri seçin veya oluşturun"); return }
    if (!fields.plate.trim() || !fields.brand.trim() || !fields.model.trim()) {
      setError("Plaka, marka ve model zorunludur"); return
    }
    setLoading(true)
    try {
      const vf = new FormData()
      vf.set("customerId", owner.id)
      vf.set("plate", fields.plate)
      vf.set("brand", fields.brand)
      vf.set("model", fields.model)
      if (fields.modelYear) vf.set("modelYear", fields.modelYear)
      vf.set("vehicleType", fields.vehicleType)
      vf.set("commercialName", fields.commercialName)
      vf.set("vin", fields.vin)
      vf.set("engineNo", fields.engineNo)
      vf.set("fuelType", fields.fuelType)
      vf.set("engineDisplacement", fields.engineDisplacement)
      vf.set("enginePower", fields.enginePower)
      vf.set("firstRegistrationDate", fields.firstRegistrationDate)
      vf.set("inspectionValidUntil", fields.inspectionValidUntil)
      const vRes = await fetch("/api/vehicles", { method: "POST", body: vf })
      const vData = await vRes.json() as { success?: boolean; id?: string; error?: string }
      if (!vData?.success || !vData.id) { setError(vData?.error || "Araç oluşturulamadı"); setLoading(false); return }
      setLoading(false)
      if (edit) { window.location.href = `/vehicles/${vData.id}`; return }
      onCreated({ customerId: owner.id, vehicleId: vData.id, plate: fields.plate, brand: fields.brand, model: fields.model, customerName: owner.label })
      onOpenChange(false)
    } catch {
      setError("Bir hata oluştu"); setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // Tarayıcı açıkken: body'ye portal'lı tam-ekran tarayıcıya dokunmak "dışarı"
        // sayılır; dış-tıklama/Esc modalı kapatmasın (tarayıcı kendi X'iyle kapanır).
        if (!next && scannerActive && (details.reason === "outside-press" || details.reason === "escape-key")) {
          details.cancel()
          return
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni araç</DialogTitle>
          <DialogDescription>Ruhsatı tarayın veya bilgileri elle girin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Ruhsat scan */}
          <RuhsattanOku
            onResult={applyOcr}
            onScannerOpenChange={setScannerActive}
            description="Tarayın; alanlar otomatik dolsun, sonra kontrol edip kaydedin."
          />

          {/* Customer */}
          <div className="space-y-1">
            <Label>Müşteri (sahip) *</Label>
            {owner ? (
              <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <span className="flex items-center gap-2 text-sm font-medium"><User className="size-4 text-primary" /> {owner.label}</span>
                {!fixedCustomer && (
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setOwner(null)} aria-label="Müşteriyi değiştir"><X className="size-4" /></Button>
                )}
              </div>
            ) : (
              <>
                <CustomerSearchOrCreate
                  onSelected={(id, label) => setOwner({ id, label })}
                  initialName={ownerSeed?.label}
                  initialType={ownerSeed?.isCorporate ? "corporate" : "individual"}
                  initialCompanyName={ownerSeed?.companyName}
                  initialFirstName={ownerSeed?.firstName}
                  initialLastName={ownerSeed?.lastName}
                  autoCreate={!!ownerSeed}
                />
              </>
            )}
          </div>

          {/* Primary vehicle fields */}
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1">Plaka * {lowConf("plate") && <AlertTriangle className="size-3 text-warning" />}</Label>
              <Input value={fields.plate} onChange={(e) => setField("plate", e.target.value.toUpperCase())} className={fieldClass("plate")} />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">Yıl {lowConf("modelYear") && <AlertTriangle className="size-3 text-warning" />}</Label>
              <Input value={fields.modelYear} onChange={(e) => setField("modelYear", e.target.value)} inputMode="numeric" className={fieldClass("modelYear")} />
            </div>
            <VehicleBrandModelPicker
              brand={fields.brand}
              model={fields.model}
              onBrandChange={(v) => setField("brand", v)}
              onModelChange={(v) => setField("model", v)}
              required
            />
          </div>

          {/* Detailed ruhsat fields */}
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <span>Ruhsat / teknik bilgiler (opsiyonel)</span>
            <ChevronDown className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>

          {showDetails && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
              <div className="space-y-1 col-span-2">
                <Label>Ticari Adı</Label>
                <Input value={fields.commercialName} onChange={(e) => setField("commercialName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1">Tipi {lowConf("vehicleType") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <Input value={fields.vehicleType} onChange={(e) => setField("vehicleType", e.target.value)} className={fieldClass("vehicleType")} />
              </div>
              <div className="space-y-1">
                <Label>Yakıt Cinsi</Label>
                <Input value={fields.fuelType} onChange={(e) => setField("fuelType", e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="flex items-center gap-1">Şase No (VIN) {lowConf("vin") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <Input value={fields.vin} onChange={(e) => setField("vin", e.target.value.toUpperCase())} className={fieldClass("vin")} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1">Motor No {lowConf("engineNo") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <Input value={fields.engineNo} onChange={(e) => setField("engineNo", e.target.value.toUpperCase())} className={fieldClass("engineNo")} />
              </div>
              <div className="space-y-1">
                <Label>Silindir Hacmi</Label>
                <Input value={fields.engineDisplacement} onChange={(e) => setField("engineDisplacement", e.target.value)} placeholder="1598" />
              </div>
              <div className="space-y-1">
                <Label>Motor Gücü</Label>
                <Input value={fields.enginePower} onChange={(e) => setField("enginePower", e.target.value)} placeholder="85 kW" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1">İlk Tescil Tarihi {lowConf("firstRegistrationDate") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <Input value={fields.firstRegistrationDate} onChange={(e) => setField("firstRegistrationDate", e.target.value)} placeholder="GG.AA.YYYY" className={fieldClass("firstRegistrationDate")} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Muayene Geçerlilik Tarihi</Label>
                <Input value={fields.inspectionValidUntil} onChange={(e) => setField("inspectionValidUntil", e.target.value)} placeholder="GG.AA.YYYY" />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleCreate(true)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur ve Düzenle"}</Button>
            <Button type="button" onClick={() => handleCreate(false)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
