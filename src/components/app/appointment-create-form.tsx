"use client"

import { useState, useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createAppointmentAction } from "@/app/(app)/appointments/actions"
import { Loader2, Info, User, CalendarClock, Bell, Plus, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { appointmentCreateFormSchema, type AppointmentCreateFormValues } from "@/lib/validations/appointment"
import { customerDisplayName } from "@/lib/format"

type CustomerOption = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

type VehicleOption = {
  id: string
  customerId: string
  plate: string
  brand: string
  model: string
}

type ActionState = {
  error: string | null
  success: boolean
  id?: string
  appointmentNo?: string
}

export function AppointmentCreateForm({
  customers,
  vehicles,
}: {
  customers: CustomerOption[]
  vehicles: VehicleOption[]
}) {
  const router = useRouter()
  async function wrappedAction(_prev: ActionState | null, formData: FormData): Promise<ActionState | null> {
    return createAppointmentAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null)
  const [customerSearch, setCustomerSearch] = useState("")

  const form = useForm<AppointmentCreateFormValues, unknown, AppointmentCreateFormValues>({
    resolver: typedResolver(appointmentCreateFormSchema),
    defaultValues: {
      customerId: "",
      vehicleId: "",
      appointmentAt: "",
      appointmentTime: "",
      estimatedDurationMinutes: "",
      title: "",
      customerRequest: "",
      internalNote: "",
      reminderEnabled: false,
    },
  })

  const customerId = form.watch("customerId")

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true
    const q = customerSearch.toLowerCase()
    const name = customerDisplayName(c).toLowerCase()
    return name.includes(q) || c.phone.includes(q)
  })

  const customerVehicles = vehicles.filter((v) => v.customerId === customerId)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/appointments/${state.id}`)
    }
  }, [state, router])

  useEffect(() => {
    if (customerId && form.getValues("vehicleId") && !customerVehicles.some((v) => v.id === form.getValues("vehicleId"))) {
      form.setValue("vehicleId", "")
    }
    if (!customerId && form.getValues("vehicleId")) {
      form.setValue("vehicleId", "")
    }
  }, [customerId, customerVehicles, form])

  function onSubmit(values: AppointmentCreateFormValues) {
    const formData = new FormData()
    formData.set("customerId", values.customerId)
    formData.set("vehicleId", values.vehicleId || "")
    formData.set("appointmentAt", values.appointmentAt)
    formData.set("appointmentTime", values.appointmentTime)
    formData.set("estimatedDurationMinutes", values.estimatedDurationMinutes || "")
    formData.set("title", values.title || "")
    formData.set("customerRequest", values.customerRequest || "")
    formData.set("internalNote", values.internalNote || "")
    formData.set("reminderEnabled", values.reminderEnabled ? "true" : "")
    formAction(formData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              Müşteri & Araç
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerSearch">Müşteri Ara</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                <Input
                  id="customerSearch"
                  type="search"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="İsim veya telefon ile ara..."
                  className="pl-9"
                />
              </div>
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Müşteri *</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Müşteri Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCustomers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {customerDisplayName(c)} - {c.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Link
                  href="/customers/new"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  <Plus className="size-3" />
                  Yeni Müşteri Ekle
                </Link>
              </div>
            </div>

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
                      disabled={!customerId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Araç Seçin (Opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Araç Seçin (Opsiyonel)</SelectItem>
                        {customerVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.plate} - {v.brand} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Link
                href={customerId ? `/vehicles/new?customerId=${customerId}` : "/vehicles/new"}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="size-3" />
                Yeni Araç Ekle
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              Randevu Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="appointmentAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Randevu Tarihi *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Randevu Saati *</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="estimatedDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tahmini Süre</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Seçiniz</SelectItem>
                        <SelectItem value="15">15 dk</SelectItem>
                        <SelectItem value="30">30 dk</SelectItem>
                        <SelectItem value="45">45 dk</SelectItem>
                        <SelectItem value="60">1 saat</SelectItem>
                        <SelectItem value="90">1.5 saat</SelectItem>
                        <SelectItem value="120">2 saat</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Örn: Periyodik Bakım" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerRequest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Müşteri Talebi</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Müşterinin randevu talebini açıklayın..." rows={3} />
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
                    <Textarea {...field} placeholder="Teknisyen için özel not..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              Hatırlatma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="reminderEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2.5 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c)}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Randevu hatırlatması planla
                  </FormLabel>
                </FormItem>
              )}
            />
            <Alert>
              <Info className="size-4" />
              <AlertDescription className="text-xs">
                Hatırlatma entegrasyonu yakında. Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pb-24 lg:pb-0">
          <Button type="submit" disabled={pending} size="lg" className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
            {pending ? "Kaydediliyor..." : "Randevu Kaydet"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
          >
            İptal
          </Button>
        </div>
      </form>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-3 safe-area-bottom flex gap-2">
        <Button type="submit" disabled={pending} size="lg" className="flex-1" onClick={() => form.handleSubmit(onSubmit)()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          className="flex-1"
        >
          İptal
        </Button>
      </div>
    </Form>
  )
}