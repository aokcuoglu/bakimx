/* eslint-disable react-hooks/incompatible-library */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, ScanLine, Loader2, Plus } from "lucide-react"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES, VEHICLE_TRANSMISSIONS, ocrVehicleTypeToSlug, ocrFuelToSlug, tecdocFuelToFormValue } from "@/lib/constants"
import { vehicleSchema, type VehicleFormValues } from "@/lib/validations/vehicle"
import { VehicleBrandModelPicker } from "@/components/vehicles/vehicle-brand-model-picker"
import { RuhsattanOku } from "@/components/vehicles/ruhsattan-oku"
import { VinResolveButton, VinCandidateList, VinLockedNotice, VinResolveNotice, useVinResolve } from "@/components/vehicles/vin-resolve"
import { isValidVin, type VinCandidate } from "@/lib/vin/types"
import { DatePicker } from "@/components/ui/date-picker"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import {
  toCustomerOptions,
  withCustomerOption,
  type CustomerLike,
} from "@/lib/vehicles/customer-options"

type Customer = CustomerLike

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

export function VehicleCreateForm({ customers, initial, mode = "create", prefillCustomerId }: VehicleFormProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Müşteri seçenekleri istemcide tutulur: form terk edilmeden oluşturulan
  // müşteri anında listeye girip seçilebilsin (#186).
  const [customerOptions, setCustomerOptions] = useState(() => toCustomerOptions(customers))
  const [customerModalOpen, setCustomerModalOpen] = useState(false)

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
  function applyCandidateFields(c: VinCandidate) {
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

  const vinResolve = useVinResolve({
    onBrand: (b) => {
      form.setValue("brand", b.name, { shouldValidate: true, shouldDirty: true })
      form.setValue("catalogBrandId", b.id, { shouldDirty: true })
    },
    onModel: (m) => {
      form.setValue("model", m.name, { shouldValidate: true, shouldDirty: true })
      form.setValue("catalogModelId", m.id, { shouldDirty: true })
    },
    onCandidate: applyCandidateFields,
  })

  async function onSubmit(values: VehicleFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      if (key === "modelYear" || key === "mileage") {
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

  /** Modal'da seçilen/oluşturulan müşteri: listeye ekle, forma yaz, modalı kapat. */
  function handleCustomerPicked(id: string, label: string) {
    setCustomerOptions((current) => withCustomerOption(current, { id, label }))
    form.setValue("customerId", id, { shouldValidate: true, shouldDirty: true })
    setCustomerModalOpen(false)
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
                      <Select
                        value={field.value}
                        onValueChange={(v) => field.onChange(v)}
                        disabled={customerOptions.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Müşteri seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => setCustomerModalOpen(true)}
                  >
                    <Plus className="size-4" />
                    Yeni müşteri ekle
                  </Button>
                </div>
                {/* Müşteri oluşturma sayfaya gitmeden burada yapılır; aksi halde
                    girilen araç bilgileri kaybolurdu (#186). */}
                <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
                  <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Müşteri ekle</DialogTitle>
                      <DialogDescription>
                        Müşteriyi arayın; kayıtlı değilse buradan yeni oluşturun. Araç bilgileriniz korunur.
                      </DialogDescription>
                    </DialogHeader>
                    {customerModalOpen && <CustomerSearchOrCreate autoFocus onSelected={handleCustomerPicked} />}
                  </DialogContent>
                </Dialog>
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
                    <p className="col-span-2 text-sm text-destructive-strong">
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
                        <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
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
                            vinResolve.resolve(form.getValues("vin") || "", {
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
                <VinResolveNotice notice={vinResolve.notice} unconfigured={vinResolve.unconfigured} />
                {vinResolve.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{vinResolve.error}</AlertDescription>
                  </Alert>
                )}
                {vinResolve.locked && <VinLockedNotice currentTier={vinResolve.lockedTier} />}
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={form.watch("catalogVehicleTypeId") ?? null}
                    onSelect={(c) => vinResolve.applyCandidate(c)}
                    onDismiss={() => vinResolve.reset()}
                  />
                )}

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
                        <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
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
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
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
                    // OCR returns free text ("BENZİNLİ - LPG", "OTOMOBİL") → map to the
                    // fixed Select slugs; unmapped values are left for the user to pick.
                    setStr("fuelType", ocrFuelToSlug(values.fuelType))
                    setStr("vehicleType", ocrVehicleTypeToSlug(values.vehicleType))
                    setStr("engineDisplacement", values.engineDisplacement)
                    setStr("enginePower", values.enginePower)
                    setStr("inspectionValidUntil", values.inspectionValidUntil)
                    const year = Number(values.modelYear)
                    if (values.modelYear && !Number.isNaN(year)) {
                      form.setValue("modelYear", year, { shouldValidate: true, shouldDirty: true })
                    }
                    // Valid VIN on the ruhsat → resolve brand/model/engine variant from the
                    // TecDoc catalog. Fire-and-forget: the OCR fill above is never blocked.
                    void vinResolve.resolve(values.vin || "", {
                      engineDisplacement: values.engineDisplacement || undefined,
                      enginePower: values.enginePower || undefined,
                      fuelType: values.fuelType || undefined,
                      firstRegistrationDate: values.registrationDate || undefined,
                      modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
                    })
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

            <div className="flex gap-3 pt-2">
              <Button type="submit" form="vehicle-form" disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Aracı Güncelle" : "Araç Kaydet"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
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
                  <Camera className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>Plaka ve marka bilgileri zorunludur.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ScanLine className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>Şase numarası (VIN) ruhsattan otomatik okunabilir veya manuel girilebilir.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="size-4 text-muted-foreground mt-0.5 shrink-0 flex items-center justify-center text-xs font-bold">i</span>
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
