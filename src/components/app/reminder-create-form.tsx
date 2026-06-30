"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Loader2, Info, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PlateBadge } from "@/components/app/plate-badge"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { reminderSchema, type ReminderFormValues } from "@/lib/validations/reminder"

type CustomerOption = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string | null
  phone: string
}

type VehicleOption = {
  id: string
  customerId: string
  plate: string
  brand: string
  model: string
  mileage: number | null
}

type Props = {
  customers: CustomerOption[]
  vehicles: VehicleOption[]
  initial?: Partial<ReminderFormValues>
  mode?: "create" | "edit"
  reminderId?: string
}

function customerLabel(c: CustomerOption): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone
}

const defaultValues: ReminderFormValues = {
  customerId: "",
  vehicleId: "",
  title: "",
  type: "other",
  dueDate: "",
  dueMileage: "",
  currentMileage: "",
  lastServiceDate: "",
  lastServiceMileage: "",
  reminderDaysBefore: "",
  reminderKmBefore: "",
  preferredChannel: "none",
  customerNote: "",
  internalNote: "",
}

export function ReminderCreateForm({ customers, vehicles, initial, mode = "create", reminderId }: Props) {
  const form = useForm<ReminderFormValues, unknown, ReminderFormValues>({
    resolver: typedResolver(reminderSchema),
    defaultValues: { ...defaultValues, ...initial },
  })

  const customerId = form.watch("customerId")
  const vehicleId = form.watch("vehicleId")

  const customerVehicles = useMemo(() => {
    if (!customerId) return vehicles
    return vehicles.filter((v) => v.customerId === customerId)
  }, [customerId, vehicles])

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === vehicleId)
  }, [vehicleId, vehicles])

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId)
  }, [customerId, customers])

  async function onSubmit(values: ReminderFormValues) {
    try {
      const formData = new FormData()
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, String(value))
      }
      if (mode === "edit" && reminderId) {
        formData.set("id", reminderId)
      }
      const action = mode === "edit" && reminderId
        ? (await import("@/app/(app)/reminders/actions")).updateReminderAction
        : (await import("@/app/(app)/reminders/actions")).createReminderAction
      await action(formData)
    } catch {
      // Hata zaten toast ile gösterilecek
    }
  }

  const loading = form.formState.isSubmitting

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
        {mode === "edit" && reminderId ? <input type="hidden" name="id" value={reminderId} /> : null}

        {form.formState.errors.root?.message ? (
          <Alert variant="destructive">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Müşteri & Araç</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v ?? "")
                            form.setValue("vehicleId", "")
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Müşteri seçin...">
                              {(value: string | null) => {
                                if (!value) return null
                                const c = customers.find((c) => c.id === value)
                                return c ? `${customerLabel(c)} (${c.phone})` : value
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Müşteri seçin...</SelectItem>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {customerLabel(c)} ({c.phone})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                      <Link href="/customers/new" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                        <Plus className="size-3" />
                        Yeni müşteri ekle
                      </Link>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Araç</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => field.onChange(v ?? "")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={customerId ? "Araç seçin..." : "Önce müşteri seçin"}>
                              {(value: string | null) => {
                                if (!value) return null
                                const v = customerVehicles.find((v) => v.id === value)
                                return v ? `${v.plate} - ${v.brand} ${v.model}` : value
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">{customerId ? "Araç seçin..." : "Önce müşteri seçin"}</SelectItem>
                            {customerVehicles.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.plate} - {v.brand} {v.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                      <Link href="/vehicles/new" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                        <Plus className="size-3" />
                        Yeni araç ekle
                      </Link>
                    </FormItem>
                  )}
                />

                {selectedVehicle ? (
                  <div className="rounded-lg border border-border bg-muted p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <PlateBadge plate={selectedVehicle.plate} />
                      <span className="text-sm font-medium text-foreground">{selectedVehicle.brand} {selectedVehicle.model}</span>
                    </div>
                    {selectedVehicle.mileage != null ? (
                      <p className="text-xs text-muted-foreground">Mevcut KM: {selectedVehicle.mileage.toLocaleString("tr-TR")} km</p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Hatırlatma Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Başlık</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Örn: 15.000 km bakımı" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bakım Türü</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                          <SelectTrigger>
                            <SelectValue>
                              {(value: string | null) => (value ? typeLabel(value) : null)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="periodic_maintenance">Periyodik Bakım</SelectItem>
                            <SelectItem value="oil_change">Yağ Bakımı</SelectItem>
                            <SelectItem value="inspection">Muayene</SelectItem>
                            <SelectItem value="tire_change">Lastik Değişimi</SelectItem>
                            <SelectItem value="brake_check">Fren Kontrolü</SelectItem>
                            <SelectItem value="battery_check">Akü Kontrolü</SelectItem>
                            <SelectItem value="insurance">Sigorta</SelectItem>
                            <SelectItem value="other">Diğer</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planlanan Tarih</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueMileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planlanan KM</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="1" placeholder="Örn: 15000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground/70">Planlanan tarih veya KM&apos;den en az biri zorunludur.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentMileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mevcut KM</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="Örn: 12000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastServiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Son Bakım Tarihi</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="lastServiceMileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Son Bakım KM</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" placeholder="Örn: 10000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Notu</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
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
                        <Textarea {...field} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Hatırlatma Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reminderDaysBefore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kaç gün önce uyarı?</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" max="365" placeholder="Örn: 7" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reminderKmBefore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kaç km önce uyarı?</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" max="50000" placeholder="Örn: 1000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="preferredChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tercih Edilen Kanal</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v) }}>
                          <SelectTrigger>
                            <SelectValue>
                              {(value: string | null) => (value ? channelLabel(value) : null)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Yok</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="phone">Telefon</SelectItem>
                            <SelectItem value="email">E-posta</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Info className="size-3" />
                        Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz. Hatırlatma kaydı ve takip altyapısı hazırlanır.
                      </p>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Özet</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Müşteri</p>
                  <p className="font-medium text-foreground">{selectedCustomer ? customerLabel(selectedCustomer) : "Seçilmedi"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Araç</p>
                  <p className="font-medium text-foreground">{selectedVehicle ? `${selectedVehicle.plate} - ${selectedVehicle.brand} ${selectedVehicle.model}` : "Seçilmedi"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bakım Türü</p>
                  <p className="font-medium text-foreground">{typeLabel(form.watch("type"))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kanal</p>
                  <p className="font-medium text-foreground">{channelLabel(form.watch("preferredChannel"))}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-warning/10 border-warning/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 text-sm text-warning-foreground">
                  <Info className="size-4 mt-0.5 shrink-0" />
                  <p>Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz. Hatırlatma kaydı ve takip altyapısı hazırlanır.</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        <div className="sticky bottom-0 sm:bottom-0 left-0 right-0 bg-card border-t border-border p-4 -mx-4 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:static lg:shadow-none lg:border-t lg:border-border lg:bg-transparent lg:p-0 lg:-mx-0">
          <Button nativeButton={false} variant="outline" render={<Link href="/reminders" />}>
            İptal
          </Button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "edit" ? "Güncelle" : "Hatırlatma Kaydet"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function typeLabel(t: string): string {
  const labels: Record<string, string> = {
    periodic_maintenance: "Periyodik Bakım",
    oil_change: "Yağ Bakımı",
    inspection: "Muayene",
    tire_change: "Lastik Değişimi",
    brake_check: "Fren Kontrolü",
    battery_check: "Akü Kontrolü",
    insurance: "Sigorta",
    other: "Diğer",
  }
  return labels[t] || t
}

function channelLabel(c: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-posta",
  }
  return labels[c] || c
}