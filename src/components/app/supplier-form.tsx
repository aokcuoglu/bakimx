"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSupplierAction, updateSupplierAction } from "@/app/app/suppliers/actions"
import { ArrowLeft, Loader2, Save, Truck, MapPin, Settings2, FileText } from "lucide-react"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { supplierSchema, type SupplierFormValues } from "@/lib/validations/supplier"
import { Alert, AlertDescription } from "@/components/ui/alert"

type SupplierData = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  website: string | null
  city: string | null
  address: string | null
  taxNumber: string | null
  taxOffice: string | null
  category: string | null
  paymentTermDays: number | null
  averageDeliveryDays: number | null
  performanceNote: string | null
  internalNote: string | null
  isActive: boolean
}

function toDefaults(supplier?: SupplierData): SupplierFormValues {
  return {
    name: supplier?.name || "",
    contactPerson: supplier?.contactPerson || "",
    phone: supplier?.phone || "",
    phone2: supplier?.phone2 || "",
    email: supplier?.email || "",
    website: supplier?.website || "",
    city: supplier?.city || "",
    address: supplier?.address || "",
    taxNumber: supplier?.taxNumber || "",
    taxOffice: supplier?.taxOffice || "",
    category: supplier?.category || "",
    paymentTermDays: supplier?.paymentTermDays ?? 0,
    averageDeliveryDays: supplier?.averageDeliveryDays ?? 0,
    performanceNote: supplier?.performanceNote || "",
    internalNote: supplier?.internalNote || "",
    isActive: supplier?.isActive !== false ? "true" : "false",
  }
}

export function SupplierForm({ supplier }: { supplier?: SupplierData }) {
  const router = useRouter()
  const isEdit = !!supplier

  const form = useForm<SupplierFormValues, unknown, SupplierFormValues>({
    resolver: typedResolver(supplierSchema),
    defaultValues: toDefaults(supplier),
  })

  type ActionState = { error?: string; success?: boolean; id?: string }
  const action = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    if (isEdit && supplier) {
      return updateSupplierAction(supplier.id, formData) as unknown as ActionState | null
    }
    return createSupplierAction(formData) as unknown as ActionState | null
  }

  const [state, formAction, pending] = useActionState(action, null as ActionState | null)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/app/suppliers/${state.id}`)
    }
  }, [state, router])

  function onSubmit(values: SupplierFormValues) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value))
    }
    formAction(formData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {state?.error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3 mb-5">
          <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"} className="text-muted-foreground/70 hover:text-muted-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"}</h2>
        </div>

        <div className="space-y-5 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="size-4 text-muted-foreground" />
                Tedarikçi Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tedarikçi Adı *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Firma adı..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yetkili Kişi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ad Soyad" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Yedek parça, yağ, lastik..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="05XX XXX XX XX" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon 2</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opsiyonel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="info@firma.com" />
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
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durum</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "true")}>
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Aktif</SelectItem>
                          <SelectItem value="false">Pasif</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                Adres & Vergi Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İl</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="İstanbul, Ankara..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Açık adres..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="taxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi No</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="TCKN / VKN" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxOffice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi Dairesi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Vergi dairesi adı" />
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
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                Operasyon Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="averageDeliveryDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ortalama Teslimat Süresi (gün)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentTermDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ödeme Vadesi (gün)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="performanceNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Performans Notu</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Tedarikçi performans değerlendirmesi..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                Notlar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={form.control}
                name="internalNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dahili Not</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="İç notlar..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3 pb-24 lg:pb-0">
            <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
              {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
              {isEdit ? "Güncelle" : "Tedarikçi Oluştur"}
            </Button>
            <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"}>
              <Button type="button" variant="outline">
                İptal
              </Button>
            </Link>
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border p-3 safe-area-bottom flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Güncelle" : "Tedarikçi Oluştur"}
          </Button>
          <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              İptal
            </Button>
          </Link>
        </div>
      </form>
    </Form>
  )
}
