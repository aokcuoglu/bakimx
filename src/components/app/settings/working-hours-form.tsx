"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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

export function WorkingHoursForm({ settings }: { settings: SettingsData }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [weekdayDays, setWeekdayDays] = useState<string[]>(parseWorkingDays(settings.weekdayWorkingDays))
  const [weekendDays, setWeekendDays] = useState<string[]>(parseWorkingDays(settings.weekendWorkingDays))
  const [holidayEnabled, setHolidayEnabled] = useState(settings.holidayEnabled)

  function toggleDay(currentDays: string[], setDays: (v: string[]) => void, dayValue: string) {
    if (currentDays.includes(dayValue)) {
      setDays(currentDays.filter((d) => d !== dayValue))
    } else {
      setDays([...currentDays, dayValue])
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("weekdayWorkingDays", serializeWorkingDays(weekdayDays))
    formData.set("weekendWorkingDays", serializeWorkingDays(weekendDays))
    formData.set("holidayEnabled", String(holidayEnabled))

    try {
      const res = await fetch("/api/settings/working-hours", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Çalışma saatleri güncellendi</div>}

      <Card>
        <CardHeader>
          <CardTitle>Hafta İçi Çalışma Saatleri</CardTitle>
          <CardDescription>Hafta içi çalışma günlerini ve saatlerini belirleyin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Çalışma Günleri</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(weekdayDays, setWeekdayDays, day.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    weekdayDays.includes(day.value)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weekdayStart">Başlangıç Saati</Label>
              <Input id="weekdayStart" name="weekdayStart" type="time" defaultValue={settings.weekdayStart} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekdayEnd">Bitiş Saati</Label>
              <Input id="weekdayEnd" name="weekdayEnd" type="time" defaultValue={settings.weekdayEnd} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hafta Sonu Çalışma Saatleri</CardTitle>
          <CardDescription>Hafta sonu çalışma günlerini ve saatlerini belirleyin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Çalışma Günleri</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(weekendDays, setWeekendDays, day.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    weekendDays.includes(day.value)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weekendStart">Başlangıç Saati</Label>
              <Input id="weekendStart" name="weekendStart" type="time" defaultValue={settings.weekendStart} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekendEnd">Bitiş Saati</Label>
              <Input id="weekendEnd" name="weekendEnd" type="time" defaultValue={settings.weekendEnd} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tatil Günleri</CardTitle>
          <CardDescription>Resmi tatil günlerinde çalışma durumunu belirleyin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="holidayEnabled"
              checked={holidayEnabled}
              onChange={(e) => setHolidayEnabled(e.target.checked)}
              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="holidayEnabled" className="cursor-pointer">Tatil günlerinde çalışma kapalı olsun</Label>
          </div>

          {holidayEnabled && (
            <div className="space-y-2">
              <Label htmlFor="holidayDates">Tatil Günleri</Label>
              <Input id="holidayDates" name="holidayDates" defaultValue={settings.holidayDates || ""} placeholder="2026-01-01, 2026-04-23, 2026-05-19" />
              <p className="text-xs text-slate-500">Virgülle ayrılmış tarih formatı (YYYY-MM-DD)</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Çalışma Saatlerini Kaydet"}
      </Button>
    </form>
  )
}