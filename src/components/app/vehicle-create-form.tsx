"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, ScanLine, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES, VEHICLE_TRANSMISSIONS } from "@/lib/constants"
import { vehicleSchema, type VehicleFormValues } from "@/lib/validations/vehicle"
import { VehicleBrandModelPicker } from "./vehicle-brand-model-picker"
import { RuhsattanOku } from "./ruhsattan-oku"
import { VinResolveButton, VinCandidateList } from "./vin-resolve"
import { isValidVin, type RuhsatHints, type VinCandidate, type VinResolution } from "@/lib/vin/types"
import { DatePicker } from "@/components/ui/date-picker"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

function customerLabel(c: Customer): string {
  const name =
    c.type === "corporate"
      ? c.companyName || "Kurumsal Müşteri"
      : c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"
  return `${name} — ${c.phone}`
}

type VehicleFormProps = {
  customers: Customer[]
  initial?: {
    id?: string
    customerId: string
    plate: string
    brand: string
    model: string
    vehicleType: string | null
    modelYear: number | null
    mileage: number | null
    vin: string | null
    vinConfirmed: boolean
    color: string | null
    engineNo: string | null
    fuelType: string | null
    transmission: string | null
    commercialName: string | null
    firstRegistrationDate: string | null
    engineDisplacement: string | null
    enginePower: string | null
    inspectionValidUntil: string | null
    catalogBrandId: number | null
    catalogModelId: number | null
    catalogVehicleTypeId: number | null
    notes: string | null
  }
  mode?: "create" | "edit"
  prefillCustomerId?: string
}

function toValues(initial?: VehicleFormProps["initial"], prefillCustomerId?: string): VehicleFormValues {
  return {
    customerId: initial?.customerId || prefillCustomerId || "",
    plate: initial?.plate || "",
    brand: initial?.brand || "",
    model: initial?.model || "",
    vehicleType: initial?.vehicleType || "",
    modelYear: initial?.modelYear ?? undefined,
    mileage: initial?.mileage ?? undefined,
    vin: initial?.vin || "",
    vinConfirmed: initial?.vinConfirmed ?? false,
    color: initial?.color || "",
    engineNo: initial?.engineNo || "",
    fuelType: initial?.fuelType || "",
    transmission: initial?.transmission || "",
    commercialName: initial?.commercialName || "",
    firstRegistrationDate: initial?.firstRegistrationDate || "",
    engineDisplacement: initial?.engineDisplacement || "",
    enginePower: initial?.enginePower || "",
    inspectionValidUntil: initial?.inspectionValidUntil || "",
    catalogBrandId: initial?.catalogBrandId ?? undefined,
    catalogModelId: initial?.catalogModelId ?? undefined,
    catalogVehicleTypeId: initial?.catalogVehicleTypeId ?? undefined,
    notes: initial?.notes || "",
  }
}

/** TecDoc English fuel_type → the form's fixed fuel Select values. */
function tecdocFuelToFormValue(fuel: string | null): string {
  if (!fuel) return ""
  const f = fuel.toLowerCase()
  if (f.includes("lpg")) return "lpg"
  if (f.includes("diesel")) return "dizel"
  if (f.includes("hybrid")) return "hibrit"
  if (f.includes("electric")) return "elektrik"
  if (f.includes("petrol")) return "benzin"
  return ""
}

type VinResolveState = {
  loading: boolean
  error: string
  notice: string
  candidates: VinCandidate[]
}

const VIN_RESOLVE_IDLE: VinResolveState = { loading: false, error: "", notice: "", candidates: [] }

export function VehicleCreateForm({ customers, initial, mode = "create", prefillCustomerId }: VehicleFormProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [vinResolve, setVinResolve] = useState<VinResolveState>(VIN_RESOLVE_IDLE)

  const isEdit = mode === "edit" && initial?.id

  const form = useForm<VehicleFormValues, unknown, VehicleFormValues>({
    resolver: typedResolver(vehicleSchema),
    defaultValues: toValues(initial, prefillCustomerId),
  })

  function clearCatalogIds(scope: "all" | "model") {
    if (scope === "all") form.setValue("catalogBrandId", undefined, { shouldDirty: true })
    form.setValue("catalogModelId", undefined, { shouldDirty: true })
    form.setValue("catalogVehicleTypeId", undefined, { shouldDirty: true })
  }

  const setIfEmpty = (name: "engineDisplacement" | "enginePower" | "fuelType" | "modelYear", value: string | number) => {
    const current = form.getValues(name)
    if (current === "" || current === undefined || current === null) {
      form.setValue(name, value as never, { shouldValidate: true, shouldDirty: true })
    }
  }

  /** Bind an engine variant: catalog ids + canonical brand/model + backfill of empty engine fields. */
  function applyCandidate(c: VinCandidate) {
    form.setValue("brand", c.brandName, { shouldValidate: true, shouldDirty: true })
    form.setValue("model", c.modelName, { shouldValidate: true, shouldDirty: true })
    form.setValue("catalogBrandId", c.brandId, { shouldDirty: true })
    form.setValue("catalogModelId", c.modelId, { shouldDirty: true })
    form.setValue("catalogVehicleTypeId", c.vehicleTypeId, { shouldDirty: true })
    if (c.cc != null) setIfEmpty("engineDisplacement", String(c.cc))
    if (c.kwt != null) setIfEmpty("enginePower", `${c.kwt} kW`)
    const fuel = tecdocFuelToFormValue(c.fuelType)
    if (fuel) setIfEmpty("fuelType", fuel)
    const year = c.yearFrom ? Number(c.yearFrom.slice(0, 4)) : NaN
    if (!Number.isNaN(year)) setIfEmpty("modelYear", year)
  }

  /** VIN → TecDoc → local catalog. Fire-and-forget; never blocks manual entry. */
  async function runVinResolve(hints: RuhsatHints) {
    const vin = form.getValues("vin") || ""
    if (!isValidVin(vin)) return
    setVinResolve({ ...VIN_RESOLVE_IDLE, loading: true })
    try {
      const res = await fetch("/api/vin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, hints }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVinResolve({ ...VIN_RESOLVE_IDLE, error: data.error || "VIN sorgulanamadı." })
        return
      }
      const result = data as VinResolution
      if (result.status === "not_found") {
        setVinResolve({ ...VIN_RESOLVE_IDLE, notice: "VIN katalogda bulunamadı — marka ve modeli manuel seçin." })
        return
      }
      if (result.brand) {
        form.setValue("brand", result.brand.name, { shouldValidate: true, shouldDirty: true })
        form.setValue("catalogBrandId", result.brand.id, { shouldDirty: true })
      }
      if (result.model) {
        form.setValue("model", result.model.name, { shouldValidate: true, shouldDirty: true })
        form.setValue("catalogModelId", result.model.id, { shouldDirty: true })
      }
      const autoCandidate =
        result.status === "resolved" && result.autoSelected != null
          ? result.candidates.find((c) => c.vehicleTypeId === result.autoSelected)
          : undefined
      if (autoCandidate) {
        applyCandidate(autoCandidate)
        setVinResolve({
          ...VIN_RESOLVE_IDLE,
          notice: `Araç katalogdan tanındı: ${autoCandidate.brandName} ${autoCandidate.modelName} ${autoCandidate.name}`,
        })
      } else if (result.status === "resolved") {
        setVinResolve({
          ...VIN_RESOLVE_IDLE,
          notice: `Araç katalogdan tanındı: ${[result.brand?.name, result.model?.name].filter(Boolean).join(" ")}`,
        })
      } else {
        setVinResolve({ ...VIN_RESOLVE_IDLE, candidates: result.candidates })
      }
    } catch {
      setVinResolve({ ...VIN_RESOLVE_IDLE, error: "VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin." })
    }
  }

  async function onSubmit(values: VehicleFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      if (key === "vinConfirmed") {
        formData.set(key, value ? "on" : "")
      } else if (key === "modelYear" || key === "mileage") {
        formData.set(key, value === undefined || value === null || (value as number | "") === "" ? "" : String(value))
      } else {
        formData.set(key, String(value ?? ""))
      }
    }

    try {
      const url = isEdit ? `/api/vehicles/${initial?.id}` : "/api/vehicles"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, { method, body: formData })
      const data = await res.json()
      if (data.success) {
        router.push(isEdit ? `/vehicles/${initial?.id}` : "/vehicles")
        router.refresh()
      } else {
        setError(data.error || (isEdit ? "Güncelleme başarısız" : "Oluşturma başarısız"))
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (isEdit) {
      router.push(`/vehicles/${initial?.id}`)
    } else {
      router.back()
    }
  }

  return (
    <Form {...form}>
      <form id="vehicle-form" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">Müşteri Bağlantısı</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri *</FormLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Müşteri seçin">
                              {(value) => {
                                const c = customers.find((x) => x.id === value)
                                return c ? customerLabel(c) : "Müşteri seçin"
                              }}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {customerLabel(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-xs text-muted-foreground">
                  <Link href="/customers/new" className="text-primary hover:text-primary/80 font-medium">
                    + Yeni müşteri ekle
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-5">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">Araç Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plaka *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="34 ABC 123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <VehicleBrandModelPicker
                    brand={form.watch("brand")}
                    model={form.watch("model")}
                    onBrandChange={(v) => {
                      form.setValue("brand", v, { shouldValidate: true })
                      // Manual override invalidates the VIN-resolved catalog linkage.
                      clearCatalogIds("all")
                    }}
                    onModelChange={(v) => {
                      form.setValue("model", v, { shouldValidate: true })
                      clearCatalogIds("model")
                    }}
                    required
                  />
                  {(form.formState.errors.brand || form.formState.errors.model) && (
                    <p className="col-span-2 text-sm text-destructive">
                      {form.formState.errors.brand?.message ?? form.formState.errors.model?.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Araç Tipi</FormLabel>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Araç tipi seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {VEHICLE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="modelYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model Yılı</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="2023"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kilometre</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="50000"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renk</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Beyaz, Siyah..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-5">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">Teknik Bilgiler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şase No (VIN)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder="1HGBH41JXMN109186" />
                        </FormControl>
                        <VinResolveButton
                          loading={vinResolve.loading}
                          disabled={!isValidVin(field.value)}
                          onClick={() =>
                            runVinResolve({
                              engineDisplacement: form.getValues("engineDisplacement") || undefined,
                              enginePower: form.getValues("enginePower") || undefined,
                              fuelType: form.getValues("fuelType") || undefined,
                              firstRegistrationDate: form.getValues("firstRegistrationDate") || undefined,
                              modelYear: form.getValues("modelYear") ?? undefined,
                            })
                          }
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {vinResolve.loading && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> VIN sorgulanıyor…
                  </p>
                )}
                {vinResolve.notice && <p className="text-sm text-muted-foreground">{vinResolve.notice}</p>}
                {vinResolve.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{vinResolve.error}</AlertDescription>
                  </Alert>
                )}
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={form.watch("catalogVehicleTypeId") ?? null}
                    onSelect={(c) => {
                      applyCandidate(c)
                      setVinResolve({
                        ...VIN_RESOLVE_IDLE,
                        notice: `Araç katalogdan tanındı: ${c.brandName} ${c.modelName} ${c.name}`,
                      })
                    }}
                    onDismiss={() => setVinResolve(VIN_RESOLVE_IDLE)}
                  />
                )}

                <FormField
                  control={form.control}
                  name="vinConfirmed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2.5 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(c) => field.onChange(c)}
                        />
                      </FormControl>
                      <FormLabel className="text-sm text-foreground cursor-pointer">
                        Şase numarası ruhsatla teyit edildi
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="engineNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motor No</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Motor numarası" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fuelType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yakıt Tipi</FormLabel>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seçiniz" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Seçiniz</SelectItem>
                            {VEHICLE_FUEL_TYPES.map((ft) => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="transmission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şanzıman</FormLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Seçiniz</SelectItem>
                          {VEHICLE_TRANSMISSIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <RuhsattanOku
                  title="Ruhsattan Oku"
                  description="Araç ruhsat fotoğrafını yükleyerek alanları otomatik doldurun."
                  onResult={({ values }) => {
                    const setStr = (name: keyof VehicleFormValues, val: string) => {
                      if (val) form.setValue(name, val, { shouldValidate: true, shouldDirty: true })
                    }
                    setStr("plate", values.plate)
                    setStr("brand", values.brand)
                    setStr("model", values.model)
                    setStr("vin", values.vin)
                    setStr("engineNo", values.engineNo)
                    setStr("firstRegistrationDate", values.registrationDate)
                    setStr("commercialName", values.commercialName)
                    setStr("fuelType", values.fuelType)
                    setStr("engineDisplacement", values.engineDisplacement)
                    setStr("enginePower", values.enginePower)
                    setStr("inspectionValidUntil", values.inspectionValidUntil)
                    const year = Number(values.modelYear)
                    if (values.modelYear && !Number.isNaN(year)) {
                      form.setValue("modelYear", year, { shouldValidate: true, shouldDirty: true })
                    }
                    // vehicleType is a fixed Select (binek/hafif_ticari…) — OCR returns free text
                    // like "OTOMOBİL", so we leave it for the user to pick rather than set an
                    // invalid value.

                    // Valid VIN on the ruhsat → resolve brand/model/engine variant from the
                    // TecDoc catalog. Fire-and-forget: the OCR fill above is never blocked.
                    if (isValidVin(values.vin)) {
                      void runVinResolve({
                        engineDisplacement: values.engineDisplacement || undefined,
                        enginePower: values.enginePower || undefined,
                        fuelType: values.fuelType || undefined,
                        firstRegistrationDate: values.registrationDate || undefined,
                        modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
                      })
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card className="mt-5">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">Ruhsat Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="commercialName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticari Adı</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ruhsattaki ticari ad" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="engineDisplacement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Silindir Hacmi</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1598" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enginePower"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motor Gücü</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="85 kW" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstRegistrationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İlk Tescil Tarihi</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Tarih seçin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inspectionValidUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Muayene Geçerlilik Tarihi</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Tarih seçin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-5">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">Notlar</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Araç Notu</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Araçla ilgili ek notlar..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="hidden sm:flex gap-3 pt-2">
              <Button type="submit" form="vehicle-form" disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Aracı Güncelle" : "Araç Kaydet"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                İptal
              </Button>
            </div>

            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-3 safe-area-bottom flex gap-2">
              <Button type="submit" form="vehicle-form" disabled={loading} className="flex-1 gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Güncelle" : "Kaydet"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
                İptal
              </Button>
            </div>
          </div>

          <aside className="hidden lg:block space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">İpuçları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Camera className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
                  <span>Plaka ve marka bilgileri zorunludur.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ScanLine className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
                  <span>Şase numarası (VIN) ruhsattan otomatik okunabilir veya manuel girilebilir.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="size-4 text-muted-foreground/70 mt-0.5 shrink-0 flex items-center justify-center text-xs font-bold">i</span>
                  <span>Tüm alanlar sonradan düzenlenebilir.</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </form>
    </Form>
  )
}