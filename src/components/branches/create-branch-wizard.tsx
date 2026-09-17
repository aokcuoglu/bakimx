"use client"

import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CityDistrictFields } from "@/components/shared/forms/city-district-fields"
import {
  BASE_RECOMMENDED_MODULES,
  REGISTER_MODULE_IDS,
  REGISTER_SECTOR_IDS,
  SETUP_PREFERENCE_IDS,
  TEAM_SIZE_IDS,
  type RegisterModuleId,
  type RegisterSectorId,
  type SetupPreferenceId,
  type TeamSizeId,
} from "@/lib/register-onboarding"
import { createBranchSchema, type CreateBranchInput } from "@/lib/validations/branch"
import { cn } from "@/lib/utils"

const STEPS = [
  { title: "Şube bilgileri", description: "Ad, iletişim ve adres" },
  { title: "Sektör ve ekip", description: "İş kolu ve ekip büyüklüğü" },
  { title: "Modüller", description: "Bu şubede kullanacağınız alanlar" },
] as const

const SECTOR_LABELS: Record<RegisterSectorId, string> = {
  auto_service: "Oto Servis",
  mechanical_service: "Mekanik Servis",
  body_paint: "Kaporta & Boya",
  spare_parts: "Yedek Parça",
  tire_service: "Lastik / Rot / Balans",
  auto_electric: "Oto Elektrik",
}

const TEAM_LABELS: Record<TeamSizeId, string> = {
  solo: "Sadece ben",
  "2_5": "2–5 kişi",
  "6_10": "6–10 kişi",
  "11_25": "11–25 kişi",
  "26_50": "26–50 kişi",
  "50_plus": "50+ kişi",
}

const MODULE_LABELS: Record<RegisterModuleId, string> = {
  customers_vehicles: "Müşteri & araç",
  work_orders: "İş emirleri",
  appointments: "Randevular",
  reports: "Raporlar",
  stock_parts: "Stok / parça",
  quotes: "Teklifler",
  cashbox: "Kasa",
  suppliers: "Tedarikçiler",
  reminders: "Hatırlatmalar",
  communications: "İletişim",
  digital_intake: "Dijital kabul",
  service_passport: "Servis pasaportu",
}

const SETUP_LABELS: Record<SetupPreferenceId, string> = {
  self_service: "Kendim kuracağım",
  data_migration: "Veri aktarımı istiyorum",
  call_me: "Beni arayın",
}

export function CreateBranchWizard({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CreateBranchInput>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      name: "",
      phone: "",
      city: "",
      district: "",
      address: "",
      sector: "auto_service",
      businessFeatures: [],
      teamSize: "2_5",
      selectedModules: [...BASE_RECOMMENDED_MODULES],
      setupPreference: "self_service",
    },
    mode: "onSubmit",
  })

  const city = useWatch({ control: form.control, name: "city" })
  const district = useWatch({ control: form.control, name: "district" })

  const stepFields = useMemo(() => {
    if (step === 0) return ["name", "phone", "city", "address"] as const
    if (step === 1) return ["sector", "teamSize"] as const
    return ["selectedModules", "setupPreference"] as const
  }, [step])

  function resetAndClose() {
    setStep(0)
    form.reset()
    onOpenChange(false)
  }

  async function goNext() {
    const ok = await form.trigger([...stepFields])
    if (!ok) return
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
      return
    }
    await onSubmit(form.getValues())
  }

  async function onSubmit(values: CreateBranchInput) {
    setSubmitting(true)
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        workshop?: { name: string }
      }
      if (!res.ok) {
        toast.error(body.error || "Şube oluşturulamadı.")
        return
      }
      toast.success(`${body.workshop?.name ?? "Şube"} oluşturuldu.`)
      resetAndClose()
      // Hard navigate so layout memberships + session mirror reload together.
      window.location.assign("/dashboard")
    } catch {
      toast.error("Şube oluşturulamadı.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto sm:max-w-xl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle>Yeni şube oluştur</DialogTitle>
          <DialogDescription>
            Adım {step + 1}/{STEPS.length}: {STEPS[step]?.description}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-5 py-5"
            onSubmit={(event) => {
              event.preventDefault()
              void goNext()
            }}
          >
            {step === 0 ? (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şube adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Örn. BakımX Kadıköy" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <Input placeholder="05xx xxx xx xx" inputMode="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <CityDistrictFields
                  city={city || ""}
                  district={district || ""}
                  onCityChange={(nextCity) => {
                    form.setValue("city", nextCity, { shouldValidate: true })
                    form.setValue("district", "")
                  }}
                  onDistrictChange={(nextDistrict) => {
                    form.setValue("district", nextDistrict, { shouldValidate: true })
                  }}
                  cityError={form.formState.errors.city?.message}
                  districtError={form.formState.errors.district?.message}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Mahalle, sokak, no" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sektör</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(value) => {
                            if (value) field.onChange(value as RegisterSectorId)
                          }}
                          className="flex flex-wrap justify-start gap-2"
                        >
                          {REGISTER_SECTOR_IDS.map((id) => (
                            <ToggleGroupItem
                              key={id}
                              value={id}
                              className="h-auto rounded-lg border px-3 py-2 text-left data-[state=on]:border-foreground data-[state=on]:bg-muted"
                            >
                              {SECTOR_LABELS[id]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ekip büyüklüğü</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(value) => {
                            if (value) field.onChange(value as TeamSizeId)
                          }}
                          className="flex flex-wrap justify-start gap-2"
                        >
                          {TEAM_SIZE_IDS.map((id) => (
                            <ToggleGroupItem
                              key={id}
                              value={id}
                              className="h-auto rounded-lg border px-3 py-2 data-[state=on]:border-foreground data-[state=on]:bg-muted"
                            >
                              {TEAM_LABELS[id]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="selectedModules"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modüller</FormLabel>
                      <FormControl>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {REGISTER_MODULE_IDS.map((id) => {
                            const selected = field.value.includes(id)
                            return (
                              <Button
                                key={id}
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-auto justify-start rounded-lg px-3 py-2 text-left text-sm whitespace-normal",
                                  selected
                                    ? "border-foreground bg-muted font-medium"
                                    : "border-border bg-background hover:bg-muted/60",
                                )}
                                onClick={() => {
                                  field.onChange(
                                    selected
                                      ? field.value.filter((m) => m !== id)
                                      : [...field.value, id],
                                  )
                                }}
                              >
                                {MODULE_LABELS[id]}
                              </Button>
                            )
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="setupPreference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kurulum tercihi</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(value) => {
                            if (value) field.onChange(value as SetupPreferenceId)
                          }}
                          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                        >
                          {SETUP_PREFERENCE_IDS.map((id) => (
                            <ToggleGroupItem
                              key={id}
                              value={id}
                              className="h-auto flex-1 rounded-lg border px-3 py-2 data-[state=on]:border-foreground data-[state=on]:bg-muted"
                            >
                              {SETUP_LABELS[id]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <DialogFooter className="gap-2 border-t border-border pt-4 sm:justify-between">
              <div className="flex gap-2">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    Geri
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" disabled={submitting} onClick={resetAndClose}>
                    Vazgeç
                  </Button>
                )}
              </div>
              <Button type="submit" variant="foreground" disabled={submitting}>
                {step < STEPS.length - 1 ? "Devam" : submitting ? "Oluşturuluyor…" : "Şubeyi oluştur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
