/* eslint-disable react-hooks/incompatible-library */
"use client"

import { useState, useActionState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Loader2, Info, User, CalendarClock, Bell, Plus, X } from "lucide-react"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { appointmentCreateFormSchema, type AppointmentCreateFormValues } from "@/lib/validations/appointment"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { InlineCreateModal, type InlineCreateResult } from "@/components/intake/inline-create-modal"
import {
  fetchCustomerVehicles,
  reconcileVehicleId,
  vehicleChoiceLabel,
  withVehicle,
  type VehicleChoice,
} from "@/lib/appointments/customer-vehicle-selection"

type ActionState = {
  error: string | null
  success: boolean
  id?: string
  appointmentNo?: string
}

export function AppointmentCreateForm() {
  const router = useRouter()
  async function wrappedAction(_prev: ActionState | null, formData: FormData): Promise<ActionState | null> {
    return createAppointmentAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null)
  // Seçili müşterinin etiketi yalnızca gösterim içindir; kimliğin tek kaynağı
  // form alanı (`customerId`) ve sunucu tarafındaki doğrulamadır.
  const [customer, setCustomer] = useState<{ id: string; label: string } | null>(null)
  const [vehicles, setVehicles] = useState<VehicleChoice[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)

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

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/appointments/${state.id}`)
    }
  }, [state, router])

  // Araç listesi seçili müşteriye göre sunucudan gelir (atölyenin tüm araçları
  // istemciye indirilmez). Liste her değiştiğinde artık geçerli olmayan seçim
  // temizlenir — sunucu action'ı zaten müşteriyle eşleşmeyen aracı reddediyor.
  useEffect(() => {
    if (!customerId) {
      setVehicles([])
      setVehiclesLoading(false)
      return
    }
    let active = true
    setVehiclesLoading(true)
    fetchCustomerVehicles(customerId)
      .then((list) => {
        if (!active) return
        setVehicles(list)
        form.setValue("vehicleId", reconcileVehicleId(form.getValues("vehicleId"), list))
      })
      .finally(() => {
        if (active) setVehiclesLoading(false)
      })
    return () => {
      active = false
    }
  }, [customerId, form])

  function selectCustomer(id: string, label: string) {
    setCustomer({ id, label })
    setVehicles([])
    form.setValue("customerId", id, { shouldValidate: true })
    form.setValue("vehicleId", "")
  }

  function clearCustomer() {
    setCustomer(null)
    setVehicles([])
    form.setValue("customerId", "", { shouldValidate: true })
    form.setValue("vehicleId", "")
  }

  // Modal, girilen plaka zaten kayıtlıysa mevcut aracı (gerçek sahibiyle) geri
  // verebilir — o sahip seçili müşteriden farklıysa seçimi ona göre düzelt.
  function onVehicleCreated(r: InlineCreateResult) {
    const created: VehicleChoice = {
      id: r.vehicleId,
      plate: r.plate ?? "",
      brand: r.brand ?? "",
      model: r.model ?? "",
    }
    if (r.customerId && r.customerId !== customer?.id) {
      setCustomer({ id: r.customerId, label: r.customerName || "Seçili müşteri" })
      form.setValue("customerId", r.customerId, { shouldValidate: true })
      setVehicles([created])
    } else {
      setVehicles((prev) => withVehicle(prev, created))
    }
    form.setValue("vehicleId", created.id)
  }

  const vehiclePlaceholder = !customerId
    ? "Önce müşteri seçin"
    : vehiclesLoading
      ? "Araçlar yükleniyor…"
      : vehicles.length === 0
        ? "Bu müşterinin kayıtlı aracı yok"
        : "Araç Seçin (Opsiyonel)"

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
    startTransition(() => formAction(formData))
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
            <FormField
              control={form.control}
              name="customerId"
              render={() => (
                <FormItem>
                  <FormLabel htmlFor="appointmentCustomerSearch">Müşteri *</FormLabel>
                  {customer ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <User className="size-4 shrink-0 text-primary" />
                        <p className="truncate font-semibold text-foreground">{customer.label}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={clearCustomer}
                        aria-label="Müşteri seçimini temizle"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <CustomerSearchOrCreate inputId="appointmentCustomerSearch" onSelected={selectCustomer} />
                  )}
                  <FormMessage />
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
                      onValueChange={(v) => field.onChange(v)}
                      disabled={!customerId || vehiclesLoading || vehicles.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={vehiclePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Araç Seçin (Opsiyonel)</SelectItem>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {vehicleChoiceLabel(v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {customer && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setVehicleModalOpen(true)}
                >
                  <Plus className="size-4" />
                  Bu müşteriye yeni araç ekle
                </Button>
              </div>
            )}
            {customer && (
              <InlineCreateModal
                open={vehicleModalOpen}
                onOpenChange={setVehicleModalOpen}
                fixedCustomer={{ id: customer.id, label: customer.label }}
                onCreated={onVehicleCreated}
              />
            )}
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
                    <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
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

        <div className="flex flex-col sm:flex-row gap-3">
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
    </Form>
  )
}