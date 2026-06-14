"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type SettingsData = {
  pdfLogoUrl: string | null
  publicPortalLogoUrl: string | null
  passportLogoUrl: string | null
  themeColor: string | null
  accentColor: string | null
}

export function BrandingForm({ settings }: { settings: SettingsData }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/settings/branding", {
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
    <Card>
      <CardHeader>
        <CardTitle>Marka Ayarları</CardTitle>
        <CardDescription>PDF, portal ve pasaport logolarınızı ve tema renklerinizi özelleştirin</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Marka ayarları güncellendi</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pdfLogoUrl">PDF Logo URL</Label>
              <Input id="pdfLogoUrl" name="pdfLogoUrl" type="url" defaultValue={settings.pdfLogoUrl || ""} placeholder="https://..." />
              <p className="text-xs text-slate-500">İş emri, pasaport ve tahsilat makbuzu PDF&apos;lerinde gösterilir</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicPortalLogoUrl">Portal Logo URL</Label>
              <Input id="publicPortalLogoUrl" name="publicPortalLogoUrl" type="url" defaultValue={settings.publicPortalLogoUrl || ""} placeholder="https://..." />
              <p className="text-xs text-slate-500">Müşteri paylaşım portalında gösterilir</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="passportLogoUrl">Pasaport Logo URL</Label>
              <Input id="passportLogoUrl" name="passportLogoUrl" type="url" defaultValue={settings.passportLogoUrl || ""} placeholder="https://..." />
              <p className="text-xs text-slate-500">Araç servis pasaportunda gösterilir</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Tema Renkleri</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="themeColor">Ana Renk</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="themeColorPicker"
                    value={settings.themeColor || "#3B82F6"}
                    onChange={(e) => {
                      const input = document.getElementById("themeColor") as HTMLInputElement
                      if (input) input.value = e.target.value
                    }}
                    className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                  />
                  <Input id="themeColor" name="themeColor" defaultValue={settings.themeColor || ""} placeholder="#3B82F6" />
                </div>
                <p className="text-xs text-slate-500">Butonlar, linkler ve vurgulu öğeler</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accentColor">Vurgu Rengi</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="accentColorPicker"
                    value={settings.accentColor || "#10B981"}
                    onChange={(e) => {
                      const input = document.getElementById("accentColor") as HTMLInputElement
                      if (input) input.value = e.target.value
                    }}
                    className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                  />
                  <Input id="accentColor" name="accentColor" defaultValue={settings.accentColor || ""} placeholder="#10B981" />
                </div>
                <p className="text-xs text-slate-500">Başarı mesajları, badge&apos;ler ve ikincil vurgu</p>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}