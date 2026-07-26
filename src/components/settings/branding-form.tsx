"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
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
import { brandingFormSchema, type BrandingFormValues } from "@/lib/validations/settings"

type SettingsData = {
  pdfLogoUrl: string | null
  publicPortalLogoUrl: string | null
  passportLogoUrl: string | null
  themeColor: string | null
  accentColor: string | null
}

function toDefaults(settings: SettingsData): BrandingFormValues {
  return {
    pdfLogoUrl: settings.pdfLogoUrl || "",
    publicPortalLogoUrl: settings.publicPortalLogoUrl || "",
    passportLogoUrl: settings.passportLogoUrl || "",
    themeColor: settings.themeColor || "",
    accentColor: settings.accentColor || "",
  }
}

export function BrandingForm({ settings }: { settings: SettingsData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<BrandingFormValues, unknown, BrandingFormValues>({
    resolver: typedResolver(brandingFormSchema),
    defaultValues: toDefaults(settings),
  })

  async function onSubmit(values: BrandingFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""))
    }

    try {
      const res = await fetch("/api/settings/branding", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Marka ayarları güncellendi")
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pdfLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PDF Logo URL</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://..." />
                    </FormControl>
                    <FormDescription>İş emri, pasaport ve tahsilat makbuzu PDF&apos;lerinde gösterilir</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicPortalLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portal Logo URL</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://..." />
                    </FormControl>
                    <FormDescription>Müşteri paylaşım portalında gösterilir</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passportLogoUrl"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Pasaport Logo URL</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://..." />
                    </FormControl>
                    <FormDescription>Araç servis pasaportunda gösterilir</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Tema Renkleri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="themeColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ana Renk</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={field.value || "#3B82F6"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="h-8 w-8 rounded border border-border cursor-pointer bg-background"
                          />
                          <Input {...field} placeholder="#3B82F6" />
                        </div>
                      </FormControl>
                      <FormDescription>Butonlar, linkler ve vurgulu öğeler</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accentColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vurgu Rengi</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={field.value || "#10B981"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="h-8 w-8 rounded border border-border cursor-pointer bg-background"
                          />
                          <Input {...field} placeholder="#10B981" />
                        </div>
                      </FormControl>
                      <FormDescription>Başarı mesajları, badge&apos;ler ve ikincil vurgu</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
              Kaydet
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}