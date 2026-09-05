"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { AlertTriangle, ChevronDown, Loader2, ScanLine } from "lucide-react"
import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES } from "@/lib/constants"
import { VehicleBrandModelPicker } from "@/components/vehicles/vehicle-brand-model-picker"
import { VinResolveButton, VinCandidateList, VinLockedNotice, VinResolveNotice, type useVinResolve } from "@/components/vehicles/vin-resolve"
import { VinScanner } from "@/components/intake/vin-scanner"
import { isValidVin, normalizeVin } from "@/lib/vin/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"

/** Ruhsattan okunan ya da elle girilen araç alanları. */
export type VehicleFields = {
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

export const EMPTY_VEHICLE_FIELDS: VehicleFields = {
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

/**
 * Sihirbazın "Araç bilgileri" adımının alan bloğu (#309). Eskiden aynı alanlar
 * dar bir diyalogun içine sıkışıyordu; burada tam genişlikte, iki kolonlu ve
 * teknik alanlar katlanabilir şekilde durur. Saf sunum: state'i sihirbaz tutar.
 */
export function EntryVehicleFields({
  fields,
  onFieldChange,
  confidence,
  showDetails,
  onToggleDetails,
  vinResolve,
  onBrandChange,
  onModelChange,
}: {
  fields: VehicleFields
  onFieldChange: (key: keyof VehicleFields, value: string) => void
  /** Ruhsat OCR güven skorları — düşükse alan sarıyla işaretlenir. */
  confidence: Record<string, number | undefined>
  showDetails: boolean
  onToggleDetails: () => void
  vinResolve: ReturnType<typeof useVinResolve>
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}) {
  const [scannerOpen, setScannerOpen] = useState(false)

  /** VIN'i katalogda sorgular; ruhsat alanları ipucu olarak gider. */
  function resolveVin(vin: string) {
    void vinResolve.resolve(vin, {
      engineDisplacement: fields.engineDisplacement || undefined,
      enginePower: fields.enginePower || undefined,
      fuelType: fields.fuelType || undefined,
      firstRegistrationDate: fields.firstRegistrationDate || undefined,
      modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
    })
  }

  const lowConf = (key: string) => {
    const c = confidence[key]
    return c !== undefined && c !== null && c < LOW_CONFIDENCE_THRESHOLD
  }
  const fieldClass = (key: string) =>
    lowConf(key) ? "border-warning/40 bg-warning/10 focus-visible:border-warning" : ""
  const warn = (key: string) => lowConf(key) && <AlertTriangle className="size-3 text-warning-strong" />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">Plaka * {warn("plate")}</Label>
          <Input
            value={fields.plate}
            onChange={(e) => onFieldChange("plate", e.target.value.toUpperCase())}
            className={fieldClass("plate")}
            placeholder="34 ABC 123"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">Model yılı {warn("modelYear")}</Label>
          <Input
            value={fields.modelYear}
            onChange={(e) => onFieldChange("modelYear", e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className={fieldClass("modelYear")}
            placeholder="2023"
          />
        </div>
        <VehicleBrandModelPicker
          brand={fields.brand}
          model={fields.model}
          onBrandChange={onBrandChange}
          onModelChange={onModelChange}
          required
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        aria-expanded={showDetails}
        onClick={onToggleDetails}
      >
        <span>Ruhsat / teknik bilgiler (opsiyonel)</span>
        <ChevronDown className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
      </Button>

      {showDetails && (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 sm:p-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Ticari adı</Label>
            <Input value={fields.commercialName} onChange={(e) => onFieldChange("commercialName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">Tipi {warn("vehicleType")}</Label>
            <Select value={fields.vehicleType} onValueChange={(v) => onFieldChange("vehicleType", v)}>
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
          <div className="space-y-1.5">
            <Label>Yakıt cinsi</Label>
            <Select value={fields.fuelType} onValueChange={(v) => onFieldChange("fuelType", v)}>
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-1">Şase no (VIN) {warn("vin")}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={fields.vin}
                onChange={(e) => onFieldChange("vin", e.target.value.toUpperCase())}
                className={`min-w-44 flex-1 ${fieldClass("vin")}`.trim()}
                placeholder="17 haneli şase numarası"
              />
              <div className="flex gap-2">
                {/* Camdaki şaseyi elle yazmak hataya açık; okutulan numara okunur
                    okunmaz katalog sorgusunu da tetikler (BAK-76). */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Şaseyi kamerayla tara"
                  title="Şaseyi kamerayla tara"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanLine className="size-4" />
                </Button>
                <VinResolveButton
                  loading={vinResolve.loading}
                  disabled={!isValidVin(fields.vin)}
                  onClick={() => resolveVin(fields.vin)}
                />
              </div>
            </div>
            {scannerOpen && (
              <VinScanner
                onDetected={(vin) => {
                  setScannerOpen(false)
                  const normalized = normalizeVin(vin)
                  onFieldChange("vin", normalized)
                  if (isValidVin(normalized)) resolveVin(normalized)
                }}
                onClose={() => setScannerOpen(false)}
              />
            )}
            {vinResolve.loading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> VIN sorgulanıyor…
              </p>
            )}
            <VinResolveNotice notice={vinResolve.notice} unconfigured={vinResolve.unconfigured} />
            {vinResolve.error && <p className="text-xs text-destructive-strong">{vinResolve.error}</p>}
            {vinResolve.locked && <VinLockedNotice currentTier={vinResolve.lockedTier} />}
            {vinResolve.candidates.length > 0 && (
              <VinCandidateList
                candidates={vinResolve.candidates}
                selectedId={null}
                onSelect={(c) => vinResolve.applyCandidate(c)}
                onDismiss={() => vinResolve.reset()}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">Motor no {warn("engineNo")}</Label>
            <Input
              value={fields.engineNo}
              onChange={(e) => onFieldChange("engineNo", e.target.value.toUpperCase())}
              className={fieldClass("engineNo")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Silindir hacmi</Label>
            <Input value={fields.engineDisplacement} onChange={(e) => onFieldChange("engineDisplacement", e.target.value)} placeholder="1598" />
          </div>
          <div className="space-y-1.5">
            <Label>Motor gücü</Label>
            <Input value={fields.enginePower} onChange={(e) => onFieldChange("enginePower", e.target.value)} placeholder="85 kW" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">İlk tescil tarihi {warn("firstRegistrationDate")}</Label>
            <DatePicker
              value={fields.firstRegistrationDate}
              onChange={(v) => onFieldChange("firstRegistrationDate", v)}
              className={fieldClass("firstRegistrationDate")}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Muayene geçerlilik tarihi</Label>
            <DatePicker value={fields.inspectionValidUntil} onChange={(v) => onFieldChange("inspectionValidUntil", v)} />
          </div>
        </div>
      )}
    </div>
  )
}
