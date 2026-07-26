"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { z } from "zod"

const appointmentRulesFormSchema = z.object({
  defaultAppointmentDuration: z.coerce
    .number()
    .int("Geçerli bir süre giriniz")
    .min(5, "En az 5 dakika olmalıdır")
    .max(480, "En fazla 480 dakika olabilir"),
  bufferDuration: z.coerce
    .number()
    .int("Geçerli bir süre giriniz")
    .min(0, "Negatif olamaz")
    .max(120, "En fazla 120 dakika olabilir"),
  reminders: z
    .array(
      z
        .string()
        .min(1, "Boş olamaz")
        .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Geçerli bir sayı giriniz")
    )
    .min(1, "En az bir hatırlatma zamanı giriniz"),
})

type AppointmentRulesFormValues = z.infer<typeof appointmentRulesFormSchema>

type SettingsData = {
  defaultAppointmentDuration: number
  bufferDuration: number
  reminderTimings: string
}

function toDefaults(settings: SettingsData): AppointmentRulesFormValues {
  const reminders = settings.reminderTimings
    ? settings.reminderTimings.split(",").filter(Boolean)
    : ["60", "30"]
  return {
    defaultAppointmentDuration: settings.defaultAppointmentDuration,
    bufferDuration: settings.bufferDuration,
    reminders: reminders.length > 0 ? reminders : ["60"],
  }
}

export function AppointmentRulesForm({ settings }: { settings: SettingsData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<AppointmentRulesFormValues, unknown, AppointmentRulesFormValues>({
    resolver: typedResolver(appointmentRulesFormSchema),
    defaultValues: toDefaults(settings),
  })

  const reminders = form.watch("reminders")

  function addReminder() {
    form.setValue("reminders", [...reminders, ""], { shouldValidate: false, shouldDirty: true })
  }

  function removeReminder(index: number) {
    form.setValue(
      "reminders",
      reminders.filter((_, i) => i !== index),
      { shouldValidate: true, shouldDirty: true }
    )
  }

  async function onSubmit(values: AppointmentRulesFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    formData.set("defaultAppointmentDuration", String(values.defaultAppointmentDuration))
    formData.set("bufferDuration", String(values.bufferDuration))
    formData.set("reminderTimings", values.reminders.filter(Boolean).join(","))

    try {
      const res = await fetch("/api/settings/appointment-rules", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Randevu kuralları güncellendi")
      } else {
        setError(data.error || "Güncelleme başarısız")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Randevu Süre Ayarları</CardTitle>
            <CardDescription>Varsayılan randevu süresi ve arabellek sürelerini yapılandırın</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="defaultAppointmentDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Varsayılan Randevu Süresi (dakika)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={5} max={480} placeholder="60" />
                    </FormControl>
                    <FormDescription>Yeni randevu oluşturulurken önerilen süre</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bufferDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arabellek Süresi (dakika)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} max={120} placeholder="15" />
                    </FormControl>
                    <FormDescription>Randevular arasındaki minimum boşluk süresi</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hatırlatma Zamanlamaları</CardTitle>
            <CardDescription>Randevu hatırlatmalarının kaç dakika önce gönderileceğini belirleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {reminders.map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={10080}
                    value={reminders[index]}
                    onChange={(e) => {
                      const next = [...reminders]
                      next[index] = e.target.value
                      form.setValue("reminders", next, { shouldValidate: false, shouldDirty: true })
                    }}
                    placeholder="Dakika cinsinden (ör: 60)"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">dakika önce</span>
                  {reminders.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReminder(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Kaldır</span>
                    </Button>
                  )}
                </div>
              ))}
              {form.formState.errors.reminders?.message && (
                <p className="text-xs text-destructive">{form.formState.errors.reminders.message}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addReminder}
                className="font-medium"
              >
                <Plus className="size-4 mr-1" />
                Hatırlatma Ekle
              </Button>
            </div>
            <FormDescription>Örnek: 60 = randevudan 1 saat önce, 1440 = 1 gün önce</FormDescription>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
          Randevu Kurallarını Kaydet
        </Button>
      </form>
    </Form>
  )
}