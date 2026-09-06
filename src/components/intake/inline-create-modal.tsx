"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import {
  VEHICLE_TYPES,
  VEHICLE_FUEL_TYPES,
  ocrVehicleTypeToSlug,
  ocrFuelToSlug,
  tecdocFuelToFormValue,
} from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Car, ChevronDown, Loader2, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { VehicleBrandModelPicker } from "@/components/vehicles/vehicle-brand-model-picker"
import { RuhsattanOku, type RuhsattanOkuResult } from "@/components/vehicles/ruhsattan-oku"
import { VinResolveButton, VinCandidateList, VinLockedNotice, VinResolveNotice, useVinResolve } from "@/components/vehicles/vin-resolve"
import { isValidVin, normalizeVin, type VinCandidate } from "@/lib/vin/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import { normalizePlate } from "@/lib/format"
import { findExactPlateMatch, type ExistingVehicleMatch } from "@/lib/search/exact-plate-match"
import type { UnifiedResult } from "@/lib/search/unified-results"

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
  initialVin,
  fixedCustomer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  initialVin?: string
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
  // Girilen plaka DB'de zaten kayıtlıysa: mevcut aracı seçime dönüştürmek için tutulur.
  const [existingMatch, setExistingMatch] = useState<ExistingVehicleMatch | null>(null)
  // VIN çözümlemesinden gelen katalog bağı — marka/model elle değiştirilirse temizlenir.
  const [catalogIds, setCatalogIds] = useState<{ brandId?: number; modelId?: number; vehicleTypeId?: number }>({})

  function setField(key: keyof VehicleFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const vinResolve = useVinResolve({
    onBrand: (b) => { setField("brand", b.name); setCatalogIds((p) => ({ ...p, brandId: b.id })) },
    onModel: (m) => { setField("model", m.name); setCatalogIds((p) => ({ ...p, modelId: m.id })) },
    onCandidate: (c: VinCandidate) => {
      setCatalogIds({ brandId: c.brandId, modelId: c.modelId, vehicleTypeId: c.vehicleTypeId })
      setFields((prev) => ({
        ...prev,
        brand: c.brandName,
        model: c.modelName,
        engineDisplacement: prev.engineDisplacement || (c.cc != null ? String(c.cc) : prev.engineDisplacement),
        enginePower: prev.enginePower || (c.kwt != null ? `${c.kwt} kW` : prev.enginePower),
        fuelType: prev.fuelType || tecdocFuelToFormValue(c.fuelType) || prev.fuelType,
        modelYear: prev.modelYear || (c.yearFrom ? String(Number(c.yearFrom.slice(0, 4))) : prev.modelYear),
      }))
    },
  })

  // Reset only on the OPEN transition (false→true), not on every prop change,
  // so the picker clearing its own query mid-session can't wipe typed values.
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    const seedVin = normalizeVin(initialVin || "")
    const hasVin = isValidVin(seedVin)
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase(), vin: hasVin ? seedVin : "" })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      // VIN ile açıldıysa teknik alanlar (VIN + sonuç) görünür başlasın.
      setShowDetails(hasVin)
      setExistingMatch(null)
      setCatalogIds({})
      vinResolve.reset()
      // Kullanıcının niyeti "VIN'den bul" → ipuçsuz oto-decode; marka/model/motor
      // beklemeden dolar, belirsizse VinCandidateList görünür.
      if (hasVin) void vinResolve.resolve(seedVin, {})
    }, 0)
  }, [open, initialPlate, initialVin, fixedCustomer]) // eslint-disable-line react-hooks/exhaustive-deps -- vinResolve is stable-shaped, re-running on its identity would loop

  // Plaka değişince mevcut aracı ara (debounce). contains araması → client'ta
  // birebir plaka filtresi. Modal kapalıyken çalışmaz.
  useEffect(() => {
    if (!open) return
    const plate = normalizePlate(fields.plate)
    if (plate.length < 5) {
      const t = setTimeout(() => setExistingMatch(null), 0)
      return () => clearTimeout(t)
    }
    let active = true
    const t = setTimeout(() => {
      fetch(`/api/search/customer-vehicle?q=${encodeURIComponent(plate)}`)
        .then((r) => r.json())
        .then((d: unknown) => {
          if (!active) return
          const results = Array.isArray((d as { results?: unknown })?.results)
            ? (d as { results: UnifiedResult[] }).results
            : []
          setExistingMatch(findExactPlateMatch(results, fields.plate))
        })
        .catch(() => { if (active) setExistingMatch(null) })
    }, 400)
    return () => { active = false; clearTimeout(t) }
  }, [open, fields.plate])

  function applyOcr({ values, confidence: conf, owner }: RuhsattanOkuResult) {
    setFields((prev) => ({
      ...prev,
      plate: values.plate || prev.plate,
      brand: values.brand || prev.brand,
      model: values.model || prev.model,
      vehicleType: ocrVehicleTypeToSlug(values.vehicleType) || prev.vehicleType,
      modelYear: values.modelYear || prev.modelYear,
      vin: values.vin || prev.vin,
      engineNo: values.engineNo || prev.engineNo,
      firstRegistrationDate: values.registrationDate || prev.firstRegistrationDate,
      commercialName: values.commercialName || prev.commercialName,
      fuelType: ocrFuelToSlug(values.fuelType) || prev.fuelType,
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
    if (isValidVin(values.vin)) {
      void vinResolve.resolve(values.vin, {
        engineDisplacement: values.engineDisplacement || undefined,
        enginePower: values.enginePower || undefined,
        fuelType: values.fuelType || undefined,
        firstRegistrationDate: values.registrationDate || undefined,
        modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
      })
    }
  }

  function lowConf(key: string): boolean {
    const c = confidence[key]
    return c !== undefined && c !== null && c < LOW_CONFIDENCE_THRESHOLD
  }

  function fieldClass(key: string): string {
    return lowConf(key) ? "border-warning/40 bg-warning/10 focus-visible:border-warning" : ""
  }

  // Kart: mevcut aracı, DB'deki gerçek sahibiyle seç. onCreated picker'a araç
  // seçimi olarak yansır. brand/model ayrı alan yok → label'ın " — " kuyruğu
  // brand olarak geçer, model boş (picker etiketi "PLAKA — Marka Model" kalır).
  function selectExisting() {
    if (!existingMatch) return
    const brandTail = existingMatch.label.split(" — ")[1] ?? ""
    const ownerName = existingMatch.sublabel.replace(/^Sahip:\s*/, "")
    onCreated({
      customerId: existingMatch.customerId,
      vehicleId: existingMatch.vehicleId,
      plate: fields.plate,
      brand: brandTail,
      model: "",
      customerName: ownerName,
    })
    onOpenChange(false)
  }

  async function handleCreate(edit: boolean) {
    setError("")
    if (!owner) { setError("Önce müşteri seçin veya oluşturun"); return }
    if (!fields.plate.trim() || !fields.brand.trim() || !fields.model.trim()) {
      setError("Plaka, marka ve model zorunludur"); return
    }
    if (existingMatch) { setError("Bu plaka zaten kayıtlı — aşağıdan mevcut aracı seçin."); return }
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
      // Şase teyidi GÖNDERİLMEZ: sunucu VIN'den türetiyor (#179, deriveVinConfirmed).
      if (catalogIds.brandId) vf.set("catalogBrandId", String(catalogIds.brandId))
      if (catalogIds.modelId) vf.set("catalogModelId", String(catalogIds.modelId))
      if (catalogIds.vehicleTypeId) vf.set("catalogVehicleTypeId", String(catalogIds.vehicleTypeId))
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Tarayıcı açıkken: body'ye portal'lı tam-ekran tarayıcıya dokunmak "dışarı"
          sayılır; dış-tıklama/Esc modalı kapatmasın (tarayıcı kendi X'iyle kapanır).
          Radix'te iptal `onOpenChange` detayıyla değil, olayın kendisini
          `preventDefault()` ile durdurarak yapılır. */}
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        onInteractOutside={(event) => {
          if (scannerActive) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (scannerActive) event.preventDefault()
        }}
      >
        <DialogHeader>
          {/* Sahibi dışarıdan sabitlenmediyse bu diyalog müşteriyi de oluşturur —
              başlık picker'daki "Yeni müşteri & araç ekle" düğmesiyle aynı şeyi söylesin. */}
          <DialogTitle>{fixedCustomer ? "Yeni araç" : "Yeni müşteri & araç"}</DialogTitle>
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
              <Label className="flex items-center gap-1">Plaka * {lowConf("plate") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
              <Input value={fields.plate} onChange={(e) => setField("plate", e.target.value.toUpperCase())} className={fieldClass("plate")} />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">Yıl {lowConf("modelYear") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
              <Input value={fields.modelYear} onChange={(e) => setField("modelYear", e.target.value)} inputMode="numeric" className={fieldClass("modelYear")} />
            </div>
            <VehicleBrandModelPicker
              brand={fields.brand}
              model={fields.model}
              onBrandChange={(v) => { setField("brand", v); setCatalogIds({}) }}
              onModelChange={(v) => { setField("model", v); setCatalogIds((p) => ({ brandId: p.brandId })) }}
              required
            />
          </div>

          {existingMatch && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning-strong mt-0.5 shrink-0" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">Bu plaka zaten kayıtlı: {existingMatch.label}</p>
                  <p className="text-xs text-muted-foreground">{existingMatch.sublabel}</p>
                </div>
              </div>
              <Button type="button" size="sm" className="w-full" onClick={selectExisting}>
                <Car className="size-4 mr-1" /> Bu aracı seç
              </Button>
            </div>
          )}

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
                <Label className="flex items-center gap-1">Tipi {lowConf("vehicleType") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
                <Select value={fields.vehicleType} onValueChange={(v) => setField("vehicleType", v)}>
                  <SelectTrigger className={`w-full ${fieldClass("vehicleType")}`}>
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.filter((t) => t.value).map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Yakıt Cinsi</Label>
                <Select value={fields.fuelType} onValueChange={(v) => setField("fuelType", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_FUEL_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="flex items-center gap-1">Şase no {lowConf("vin") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
                <div className="flex gap-2">
                  <Input value={fields.vin} onChange={(e) => setField("vin", e.target.value.toUpperCase())} className={fieldClass("vin")} />
                  <VinResolveButton
                    loading={vinResolve.loading}
                    disabled={!isValidVin(fields.vin)}
                    onClick={() =>
                      vinResolve.resolve(fields.vin, {
                        engineDisplacement: fields.engineDisplacement || undefined,
                        enginePower: fields.enginePower || undefined,
                        fuelType: fields.fuelType || undefined,
                        firstRegistrationDate: fields.firstRegistrationDate || undefined,
                        modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
                      })
                    }
                  />
                </div>
                {vinResolve.loading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> Şase sorgulanıyor…
                  </p>
                )}
                <VinResolveNotice notice={vinResolve.notice} unconfigured={vinResolve.unconfigured} />
                {vinResolve.error && <p className="text-xs text-destructive-strong">{vinResolve.error}</p>}
                {vinResolve.locked && <VinLockedNotice currentTier={vinResolve.lockedTier} />}
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={catalogIds.vehicleTypeId ?? null}
                    onSelect={(c) => vinResolve.applyCandidate(c)}
                    onDismiss={() => vinResolve.reset()}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1">Motor No {lowConf("engineNo") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
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
                <Label className="flex items-center gap-1">İlk Tescil Tarihi {lowConf("firstRegistrationDate") && <AlertTriangle className="size-3 text-warning-strong" />}</Label>
                <DatePicker value={fields.firstRegistrationDate} onChange={(v) => setField("firstRegistrationDate", v)} className={fieldClass("firstRegistrationDate")} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Muayene Geçerlilik Tarihi</Label>
                <DatePicker value={fields.inspectionValidUntil} onChange={(v) => setField("inspectionValidUntil", v)} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive-strong">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleCreate(true)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur ve Düzenle"}</Button>
            <Button type="button" onClick={() => handleCreate(false)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
