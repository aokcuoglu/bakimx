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
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  businessProfileFormSchema,
  type BusinessProfileFormValues,
} from "@/lib/validations/settings"

type WorkshopData = {
  id: string
  name: string
  phone: string
  city: string
  district: string | null
  address: string
  email: string | null
  website: string | null
  logoUrl: string | null
  taxNumber: string | null
  taxOffice: string | null
  invoiceTitle: string | null
}

function toDefaults(workshop: WorkshopData): BusinessProfileFormValues {
  return {
    name: workshop.name || "",
    phone: workshop.phone || "",
    city: workshop.city || "",
    district: workshop.district || "",
    address: workshop.address || "",
    email: workshop.email || "",
    website: workshop.website || "",
    logoUrl: workshop.logoUrl || "",
    taxNumber: workshop.taxNumber || "",
    taxOffice: workshop.taxOffice || "",
    invoiceTitle: workshop.invoiceTitle || "",
  }
}

export function BusinessProfileForm({ workshop }: { workshop: WorkshopData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<BusinessProfileFormValues, unknown, BusinessProfileFormValues>({
    resolver: typedResolver(businessProfileFormSchema),
    defaultValues: toDefaults(workshop),
  })

  async function onSubmit(values: BusinessProfileFormValues) {
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/workshop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Bilgiler güncellendi")
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
        <CardTitle>İş Yeri Bilgileri</CardTitle>
        <CardDescription>İş yeri temel bilgilerinizi güncelleyin</CardDescription>
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
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>İş Yeri Adı *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="İş yeri adı" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon *</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="Telefon" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="info@isyeri.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Şehir *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Şehir" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İlçe</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="İlçe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Adres *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Açık adres" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Web Sitesi</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Vergi Bilgileri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxOffice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi Dairesi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Vergi dairesi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi Numarası</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Vergi numarası" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceTitle"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Fatura Ünvanı</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Fatura ünvanı" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
              Güncelle
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}