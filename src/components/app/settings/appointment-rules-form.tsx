"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type SettingsData = {
  defaultAppointmentDuration: number
  bufferDuration: number
  reminderTimings: string
}

export function AppointmentRulesForm({ settings }: { settings: SettingsData }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [reminders, setReminders] = useState<string[]>(settings.reminderTimings ? settings.reminderTimings.split(",").filter(Boolean) : ["60", "30"])

  function addReminder() {
    setReminders([...reminders, ""])
  }

  function removeReminder(index: number) {
    setReminders(reminders.filter((_, i) => i !== index))
  }

  function updateReminder(index: number, value: string) {
    const updated = [...reminders]
    updated[index] = value
    setReminders(updated)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("reminderTimings", reminders.filter(Boolean).join(","))

    try {
      const res = await fetch("/api/settings/appointment-rules", {
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
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Randevu kuralları güncellendi</div>}

      <Card>
        <CardHeader>
          <CardTitle>Randevu Süre Ayarları</CardTitle>
          <CardDescription>Varsayılan randevu süresi ve arabellek sürelerini yapılandırın</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultAppointmentDuration">Varsayılan Randevu Süresi (dakika)</Label>
              <Input id="defaultAppointmentDuration" name="defaultAppointmentDuration" type="number" min={5} max={480} defaultValue={settings.defaultAppointmentDuration} />
              <p className="text-xs text-slate-500">Yeni randevu oluşturulurken önerilen süre</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bufferDuration">Arabellek Süresi (dakika)</Label>
              <Input id="bufferDuration" name="bufferDuration" type="number" min={0} max={120} defaultValue={settings.bufferDuration} />
              <p className="text-xs text-slate-500">Randevular arasındaki minimum boşluk süresi</p>
            </div>
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
            {reminders.map((timing, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={5}
                    max={10080}
                    value={timing}
                    onChange={(e) => updateReminder(index, e.target.value)}
                    placeholder="Dakika cinsinden (ör: 60)"
                  />
                </div>
                <span className="text-sm text-slate-500 whitespace-nowrap">dakika önce</span>
                {reminders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeReminder(index)}
                    className="text-sm text-rose-600 hover:text-rose-800 font-medium whitespace-nowrap"
                  >
                    Kaldır
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addReminder}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Hatırlatma Ekle
            </button>
          </div>
          <p className="text-xs text-slate-500">Örnek: 60 = randevudan 1 saat önce, 1440 = 1 gün önce</p>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Randevu Kurallarını Kaydet"}
      </Button>
    </form>
  )
}