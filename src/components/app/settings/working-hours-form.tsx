"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
import { workingHoursFormSchema, type WorkingHoursFormValues } from "@/lib/validations/settings"

type SettingsData = {
  weekdayStart: string
  weekdayEnd: string
  weekdayWorkingDays: string
  weekendStart: string
  weekendEnd: string
  weekendWorkingDays: string
  holidayEnabled: boolean
  holidayDates: string | null
}

const DAY_OPTIONS = [
  { value: "1", label: "Pazartesi" },
  { value: "2", label: "Salı" },
  { value: "3", label: "Çarşamba" },
  { value: "4", label: "Perşembe" },
  { value: "5", label: "Cuma" },
  { value: "6", label: "Cumartesi" },
  { value: "0", label: "Pazar" },
]

function parseWorkingDays(str: string): string[] {
  return str ? str.split(",").filter(Boolean) : []
}

function serializeWorkingDays(arr: string[]): string {
  return arr.join(",")
}

function toDefaults(settings: SettingsData): WorkingHoursFormValues {
  return {
    weekdayStart: settings.weekdayStart || "09:00",
    weekdayEnd: settings.weekdayEnd || "18:00",
    weekdayWorkingDays: settings.weekdayWorkingDays || "",
    weekendStart: settings.weekendStart || "10:00",
    weekendEnd: settings.weekendEnd || "14:00",
    weekendWorkingDays: settings.weekendWorkingDays || "",
    holidayEnabled: settings.holidayEnabled,
    holidayDates: settings.holidayDates || "",
  }
}

export function WorkingHoursForm({ settings }: { settings: SettingsData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<WorkingHoursFormValues, unknown, WorkingHoursFormValues>({
    resolver: typedResolver(workingHoursFormSchema),
    defaultValues: toDefaults(settings),
  })

  const weekdayDays = parseWorkingDays(form.watch("weekdayWorkingDays"))
  const weekendDays = parseWorkingDays(form.watch("weekendWorkingDays"))
  const holidayEnabled = form.watch("holidayEnabled")

  function toggleDay(field: "weekdayWorkingDays" | "weekendWorkingDays", dayValue: string) {
    const current = parseWorkingDays(form.getValues(field))
    const next = current.includes(dayValue)
      ? current.filter((d) => d !== dayValue)
      : [...current, dayValue]
    form.setValue(field, serializeWorkingDays(next), { shouldValidate: true })
  }

  async function onSubmit(values: WorkingHoursFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""))
    }

    try {
      const res = await fetch("/api/settings/working-hours", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Çalışma saatleri güncellendi")
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
            <CardTitle>Hafta İçi Çalışma Saatleri</CardTitle>
            <CardDescription>Hafta içi çalışma günlerini ve saatlerini belirleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="weekdayWorkingDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Çalışma Günleri</FormLabel>
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const active = weekdayDays.includes(day.value)
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDay("weekdayWorkingDays", day.value)}
                        >
                          {day.label}
                        </Button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="weekdayStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başlangıç Saati</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weekdayEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bitiş Saati</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hafta Sonu Çalışma Saatleri</CardTitle>
            <CardDescription>Hafta sonu çalışma günlerini ve saatlerini belirleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="weekendWorkingDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Çalışma Günleri</FormLabel>
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const active = weekendDays.includes(day.value)
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDay("weekendWorkingDays", day.value)}
                        >
                          {day.label}
                        </Button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="weekendStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başlangıç Saati</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weekendEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bitiş Saati</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tatil Günleri</CardTitle>
            <CardDescription>Resmi tatil günlerinde çalışma durumunu belirleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="holidayEnabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c)}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Tatil günlerinde çalışma kapalı olsun</FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {holidayEnabled && (
              <FormField
                control={form.control}
                name="holidayDates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tatil Günleri</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="2026-01-01, 2026-04-23, 2026-05-19" />
                    </FormControl>
                    <FormDescription>Virgülle ayrılmış tarih formatı (YYYY-MM-DD)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
          Çalışma Saatlerini Kaydet
        </Button>
      </form>
    </Form>
  )
}