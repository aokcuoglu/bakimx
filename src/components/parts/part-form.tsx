"use client"

import { useActionState, useEffect, useMemo, useState, startTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
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
import { PartSupplierPricesField, type SupplierPriceFormRow } from "@/components/parts/part-supplier-prices-field"

const CURRENCY_LABELS: Record<string, string> = {
  TRY: "₺ TRY",
  USD: "$ USD",
  EUR: "€ EUR",
}

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

/** TecDoc supplier — parça markası (Marka Autocomplete'ini doldurur). */
type Brand = { supplierId: number; name: string }

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

function toDefaults(part?: PartData, supplierPrices: SupplierPriceFormRow[] = []): PartFormValues {
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
    // Stored in kuruş; the form input holds TRY.
    salePrice: part?.salePrice != null ? kurusToLira(part.salePrice) : 0,
    currency: (part?.currency as "TRY" | "USD" | "EUR") || "TRY",
    supplierName: part?.supplierName || "",
    supplierPhone: part?.supplierPhone || "",
    supplierId: part?.supplierId || "",
    shelfLocation: part?.shelfLocation || "",
    barcode: part?.barcode || "",
    supplierPrices,
  }
}

export function PartForm({
  part,
  suppliers,
  workshopBrands = [],
  supplierPrices = [],
}: {
  part?: PartData
  suppliers?: SupplierOption[]
  workshopBrands?: string[]
  supplierPrices?: SupplierPriceFormRow[]
}) {
  const router = useRouter()
  const isEdit = !!part

  const form = useForm<PartFormValues, unknown, PartFormValues>({
    resolver: typedResolver(partSchema),
    defaultValues: toDefaults(part, supplierPrices),
  })

  // Parça markaları (TecDoc suppliers) — araç-bağımsız, tek sefer çekilir.
  // Autocomplete serbest girişi destekler: liste boş olsa da yazılan değer geçerli.
  const [brands, setBrands] = useState<Brand[]>([])
  useEffect(() => {
    let active = true
    fetch("/api/tecdoc/brands")
      .then((r) => r.json())
      .then((d) => { if (active) setBrands(Array.isArray(d?.brands) ? d.brands : []) })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
  }, [])

  // Öneriler: atölyenin kendi markaları önce, ardından TecDoc markaları (tekilleştirilmiş).
  const brandOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const b of [...workshopBrands, ...brands.map((x) => x.name)]) {
      const key = b.trim().toLocaleLowerCase("tr")
      if (!b.trim() || seen.has(key)) continue
      seen.add(key)
      out.push(b.trim())
    }
    return out
  }, [workshopBrands, brands])

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
      if (key === "supplierPrices") continue
      formData.set(key, String(value))
    }
    // Satış fiyatı TRY girilir, kuruş saklanır.
    formData.set("salePrice", String(liraToKurus(Number(values.salePrice) || 0)))
    // Tedarikçi satırları JSON olarak gider; fiyatlar kuruşa çevrilir.
    formData.set(
      "supplierPrices",
      JSON.stringify(
        values.supplierPrices.map((r) => ({
          supplierId: r.supplierId,
          purchasePrice: liraToKurus(Number(r.purchasePrice) || 0),
          supplierSku: r.supplierSku,
          isPreferred: r.isPreferred,
        }))
      )
    )
    startTransition(() => formAction(formData))
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

        <div className="space-y-5">
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
                      <FormLabel>Parça Kodu / SKU *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Örn. 0986424815" />
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
                        <Autocomplete
                          items={brandOptions}
                          value={field.value}
                          autoHighlight
                          openOnInputClick
                          itemToStringValue={(b: string) => b}
                          onValueChange={(v: string) => field.onChange(v)}
                        >
                          <AutocompleteInput render={<Input placeholder="Bosch, Mann, OEM..." />} />
                          <AutocompleteContent>
                            <AutocompleteEmpty>Listede yok — yazdığınız marka kaydedilir</AutocompleteEmpty>
                            <AutocompleteList>
                              {(b: string) => (
                                <AutocompleteItem key={b} value={b} onClick={() => field.onChange(b)}>
                                  <span className="block truncate">{b}</span>
                                </AutocompleteItem>
                              )}
                            </AutocompleteList>
                          </AutocompleteContent>
                        </Autocomplete>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <SelectValue placeholder="Para Birimi">
                              {(value: string | null) => (value ? CURRENCY_LABELS[value] ?? value : null)}
                            </SelectValue>
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
              <CardTitle className="text-sm font-semibold">Tedarikçiler & Alış Fiyatları</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="supplierPrices"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PartSupplierPricesField
                        suppliers={suppliers ?? []}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Alış fiyatı tedarikçi bazlı tutulur. Varsayılan tedarikçinin fiyatı parçanın alış fiyatı olarak kullanılır.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
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
      </form>
    </Form>
  )
}