"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { pdfTemplatesFormSchema, type PdfTemplatesFormValues } from "@/lib/validations/settings"

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

function toDefaults(settings: SettingsData): PdfTemplatesFormValues {
  return {
    workOrderTemplate: settings.workOrderTemplate || "",
    servicePassportTemplate: settings.servicePassportTemplate || "",
    collectionReceiptTemplate: settings.collectionReceiptTemplate || "",
  }
}

export function PdfTemplatesForm({ settings }: { settings: SettingsData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<PdfTemplatesFormValues, unknown, PdfTemplatesFormValues>({
    resolver: typedResolver(pdfTemplatesFormSchema),
    defaultValues: toDefaults(settings),
  })

  async function onSubmit(values: PdfTemplatesFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""))
    }

    try {
      const res = await fetch("/api/settings/pdf-templates", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("PDF şablonları güncellendi")
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
            <CardTitle>İş Emri Şablonu</CardTitle>
            <CardDescription>İş emri PDF çıktısında kullanılacak şablonu özelleştirin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="workOrderTemplate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>İş Emri Şablon İçeriği</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.onChange(DEFAULT_WORK_ORDER)}
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Varsayılana Sıfırla
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={10}
                      className="font-mono text-xs"
                      placeholder="İş emri PDF şablonunu buraya yazın..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Kullanılabilir değişkenler:</p>
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
            <FormField
              control={form.control}
              name="servicePassportTemplate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Pasaport Şablon İçeriği</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.onChange(DEFAULT_SERVICE_PASSPORT)}
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Varsayılana Sıfırla
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={10}
                      className="font-mono text-xs"
                      placeholder="Servis pasaportu PDF şablonunu buraya yazın..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Kullanılabilir değişkenler:</p>
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
            <FormField
              control={form.control}
              name="collectionReceiptTemplate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Makbuz Şablon İçeriği</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => field.onChange(DEFAULT_COLLECTION_RECEIPT)}
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Varsayılana Sıfırla
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={10}
                      className="font-mono text-xs"
                      placeholder="Tahsilat makbuzu PDF şablonunu buraya yazın..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Kullanılabilir değişkenler:</p>
              <p>{"{{receiptNo}}, {{workshopName}}, {{customerName}}, {{date}}, {{amount}}, {{paymentMethod}}, {{workOrderNo}}, {{workshopPhone}}"}</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
          PDF Şablonlarını Kaydet
        </Button>
      </form>
    </Form>
  )
}