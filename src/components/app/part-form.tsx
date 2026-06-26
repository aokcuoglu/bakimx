"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createPartAction, updatePartAction } from "@/app/(app)/parts/actions"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { partSchema, type PartFormValues } from "@/lib/validations/part"

type PartData = {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  brand: string | null
  category: string | null
  description: string | null
  unit: string
  stockQty: number
  criticalStockQty: number
  purchasePrice: number | null
  salePrice: number | null
  currency: string
  supplierName: string | null
  supplierPhone: string | null
  supplierId: string | null
  shelfLocation: string | null
  barcode: string | null
}

type SupplierOption = {
  id: string
  name: string
  phone: string | null
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

function toDefaults(part?: PartData): PartFormValues {
  return {
    name: part?.name || "",
    sku: part?.sku || "",
    oemNo: part?.oemNo || "",
    brand: part?.brand || "",
    category: part?.category || "",
    description: part?.description || "",
    unit: part?.unit || "adet",
    stockQty: part?.stockQty ?? 0,
    criticalStockQty: part?.criticalStockQty ?? 0,
    purchasePrice: part?.purchasePrice ?? 0,
    salePrice: part?.salePrice ?? 0,
    currency: (part?.currency as "TRY" | "USD" | "EUR") || "TRY",
    supplierName: part?.supplierName || "",
    supplierPhone: part?.supplierPhone || "",
    supplierId: part?.supplierId || "",
    shelfLocation: part?.shelfLocation || "",
    barcode: part?.barcode || "",
  }
}

export function PartForm({ part, suppliers }: { part?: PartData; suppliers?: SupplierOption[] }) {
  const router = useRouter()
  const isEdit = !!part

  const form = useForm<PartFormValues, unknown, PartFormValues>({
    resolver: typedResolver(partSchema),
    defaultValues: toDefaults(part),
  })

  const action = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    if (isEdit && part) {
      return updatePartAction(part.id, formData) as unknown as Promise<ActionState | null>
    }
    return createPartAction(formData) as unknown as Promise<ActionState | null>
  }

  const [state, formAction, pending] = useActionState(action, null as ActionState | null)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/parts/${state.id}`)
    }
  }, [state, router])

  function onSubmit(values: PartFormValues) {
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
          <Link href={isEdit ? `/parts/${part?.id}` : "/parts"} className="text-muted-foreground/70 hover:text-muted-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Parça Düzenle" : "Yeni Parça"}</h2>
        </div>

        <div className="space-y-5 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Parça Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parça Adı *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Fren balatası, yağ filtresi..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parça Kodu / SKU</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opsiyonel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="oemNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OEM No</FormLabel>
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
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marka</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bosch, Mann, OEM..." />
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
                        <Input {...field} placeholder="Fren, Motor, Filtre..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Açıklama</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Opsiyonel açıklama..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Stok Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="stockQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stok Miktarı</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="criticalStockQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kritik Stok Miktarı</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birim</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="adet, litre, kg..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="shelfLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raf / Lokasyon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="A-01, B-12..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barkod</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opsiyonel" />
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
              <CardTitle className="text-sm font-semibold">Fiyat Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alış Fiyatı</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="0.01" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Satış Fiyatı</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" step="0.01" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Para Birimi</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "TRY")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Para Birimi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRY">₺ TRY</SelectItem>
                            <SelectItem value="USD">$ USD</SelectItem>
                            <SelectItem value="EUR">€ EUR</SelectItem>
                          </SelectContent>
                        </Select>
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
              <CardTitle className="text-sm font-semibold">Tedarikçi Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suppliers && suppliers.length > 0 && (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tedarikçi Seç</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Tedarikçi seçin (opsiyonel)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Tedarikçi seçin (opsiyonel)</SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}{s.phone ? ` — ${s.phone}` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="supplierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tedarikçi Adı (metin)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Tedarikçi adı..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tedarikçi Telefonu</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="05XX XXX XX XX" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/70">Seçili tedarikçi önceliklidir. Eski kayıtlar metin alanını kullanmaya devam eder.</p>
            </CardContent>
          </Card>

          <div className="flex gap-3 pb-24 lg:pb-0">
            <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
              {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
              {isEdit ? "Güncelle" : "Parça Oluştur"}
            </Button>
            <Link href={isEdit ? `/parts/${part?.id}` : "/parts"}>
              <Button type="button" variant="outline">
                İptal
              </Button>
            </Link>
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border p-3 safe-area-bottom flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Güncelle" : "Parça Oluştur"}
          </Button>
          <Link href={isEdit ? `/parts/${part?.id}` : "/parts"} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              İptal
            </Button>
          </Link>
        </div>
      </form>
    </Form>
  )
}