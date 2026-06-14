"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type SettingsData = {
  workOrderTemplate: string | null
  servicePassportTemplate: string | null
  collectionReceiptTemplate: string | null
}

const DEFAULT_WORK_ORDER = `İş Emri #{{workOrderNo}}
İş Yeri: {{workshopName}}
Müşteri: {{customerName}}
Araç: {{vehiclePlate}} - {{vehicleBrand}} {{vehicleModel}}
Tarih: {{date}}
---
Şikayet: {{customerComplaint}}
Yapılan İşlemler:
{{#each items}}
- {{name}} x{{quantity}} {{unitPrice}} TL
{{/each}}
---
Toplam: {{totalAmount}} TL`

const DEFAULT_SERVICE_PASSPORT = `Servis Pasaportu
İş Yeri: {{workshopName}}
Araç: {{vehiclePlate}} - {{vehicleBrand}} {{vehicleModel}}
Müşteri: {{customerName}}
---
Servis Geçmişi:
{{#each orders}}
- {{date}}: {{description}} ({{status}})
{{/each}}
---
Son KM: {{lastMileage}}
Son Servis: {{lastServiceDate}}`

const DEFAULT_COLLECTION_RECEIPT = `Tahsilat Makbuzu #{{receiptNo}}
İş Yeri: {{workshopName}}
Müşteri: {{customerName}}
Tarih: {{date}}
---
Tutar: {{amount}} TL
Ödeme Yöntemi: {{paymentMethod}}
İş Emri: {{workOrderNo}}
---
{{workshopName}} - {{workshopPhone}}`

export function PdfTemplatesForm({ settings }: { settings: SettingsData }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [workOrderTemplate, setWorkOrderTemplate] = useState(settings.workOrderTemplate || "")
  const [servicePassportTemplate, setServicePassportTemplate] = useState(settings.servicePassportTemplate || "")
  const [collectionReceiptTemplate, setCollectionReceiptTemplate] = useState(settings.collectionReceiptTemplate || "")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")
    setLoading(true)

    const formData = new FormData()
    formData.set("workOrderTemplate", workOrderTemplate)
    formData.set("servicePassportTemplate", servicePassportTemplate)
    formData.set("collectionReceiptTemplate", collectionReceiptTemplate)

    try {
      const res = await fetch("/api/settings/pdf-templates", {
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
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">PDF şablonları güncellendi</div>}

      <Card>
        <CardHeader>
          <CardTitle>İş Emri Şablonu</CardTitle>
          <CardDescription>İş emri PDF çıktısında kullanılacak şablonu özelleştirin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="workOrderTemplate">İş Emri Şablon İçeriği</Label>
              <button
                type="button"
                onClick={() => setWorkOrderTemplate(DEFAULT_WORK_ORDER)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Varsayılana Sıfırla
              </button>
            </div>
            <Textarea
              id="workOrderTemplate"
              value={workOrderTemplate}
              onChange={(e) => setWorkOrderTemplate(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="İş emri PDF şablonunu buraya yazın..."
            />
          </div>
          <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Kullanılabilir değişkenler:</p>
            <p>{"{{workOrderNo}}, {{workshopName}}, {{customerName}}, {{vehiclePlate}}, {{vehicleBrand}}, {{vehicleModel}}, {{date}}, {{customerComplaint}}, {{totalAmount}}"}</p>
            <p>{"{{#each items}}...{{/each}} — kalemler listesi"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servis Pasaportu Şablonu</CardTitle>
          <CardDescription>Araç servis pasaportunda kullanılacak şablonu özelleştirin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="servicePassportTemplate">Pasaport Şablon İçeriği</Label>
              <button
                type="button"
                onClick={() => setServicePassportTemplate(DEFAULT_SERVICE_PASSPORT)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Varsayılana Sıfırla
              </button>
            </div>
            <Textarea
              id="servicePassportTemplate"
              value={servicePassportTemplate}
              onChange={(e) => setServicePassportTemplate(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="Servis pasaportu PDF şablonunu buraya yazın..."
            />
          </div>
          <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Kullanılabilir değişkenler:</p>
            <p>{"{{workshopName}}, {{customerName}}, {{vehiclePlate}}, {{vehicleBrand}}, {{vehicleModel}}, {{lastMileage}}, {{lastServiceDate}}"}</p>
            <p>{"{{#each orders}}...{{/each}} — servis geçmişi listesi"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tahsilat Makbuzu Şablonu</CardTitle>
          <CardDescription>Tahsilat makbuzu PDF çıktısında kullanılacak şablonu özelleştirin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="collectionReceiptTemplate">Makbuz Şablon İçeriği</Label>
              <button
                type="button"
                onClick={() => setCollectionReceiptTemplate(DEFAULT_COLLECTION_RECEIPT)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Varsayılana Sıfırla
              </button>
            </div>
            <Textarea
              id="collectionReceiptTemplate"
              value={collectionReceiptTemplate}
              onChange={(e) => setCollectionReceiptTemplate(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="Tahsilat makbuzu PDF şablonunu buraya yazın..."
            />
          </div>
          <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Kullanılabilir değişkenler:</p>
            <p>{"{{receiptNo}}, {{workshopName}}, {{customerName}}, {{date}}, {{amount}}, {{paymentMethod}}, {{workOrderNo}}, {{workshopPhone}}"}</p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Kaydediliyor..." : "PDF Şablonlarını Kaydet"}
      </Button>
    </form>
  )
}