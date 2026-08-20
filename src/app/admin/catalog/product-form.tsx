"use client"

import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  bakimxProductFormSchema,
  type BakimxProductFormValues,
} from "@/lib/validations/bakimx-product"
import { BAKIMX_CATEGORIES, parseOemNumbers } from "@/lib/catalog/bakimx-catalog"
import { bpsToPercent, formatKurus, grossFromNetKurus, kurusToLira, liraToKurus, percentToBps } from "@/lib/money"
import { createBakimxProductAction, updateBakimxProductAction } from "@/app/admin/catalog/actions"
import type { CatalogBrandOption } from "@/app/admin/catalog/data"
import { VehicleTypeSelector } from "@/components/catalog/vehicle-type-selector"

export interface CatalogProductFormData {
  id: string
  sku: string
  name: string
  brandId: string
  categoryKey: string | null
  tecdocCategoryId: number | null
  barcode: string | null
  unit: string
  description: string | null
  imageUrl: string | null
  oemNumbers: string[]
  workshopPriceKurus: number
  vatRateBps: number
  costPriceKurus: number | null
  stockQty: number
  lowStockQty: number
  backorderable: boolean
  leadTimeDays: number | null
  isActive: boolean
  fitmentScope: "universal" | "vehicle_linked"
  vehicleTypeIds: number[]
}

interface TecdocCategory {
  id: number
  name: string
}

interface TecdocCategory {
  id: number
  name: string
}

interface TecdocCategory {
  id: number
  name: string
}

/** Yaygın KDV oranları — serbest giriş yerine sabit liste (yanlış oran = yanlış KDV dahil fiyat). */
const VAT_RATES = [0, 1, 10, 20]

function toDefaults(product?: CatalogProductFormData): BakimxProductFormValues {
  return {
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    brandId: product?.brandId ?? "",
    categoryKey: product?.categoryKey ?? "",
    tecdocCategoryId: product?.tecdocCategoryId ?? null,
    barcode: product?.barcode ?? "",
    unit: product?.unit ?? "adet",
    description: product?.description ?? "",
    imageUrl: product?.imageUrl ?? "",
    oemNumbers: product?.oemNumbers.join(", ") ?? "",
    workshopPrice: product ? kurusToLira(product.workshopPriceKurus) : 0,
    vatRate: product ? bpsToPercent(product.vatRateBps) : 20,
    costPrice: product?.costPriceKurus != null ? String(kurusToLira(product.costPriceKurus)) : "",
    stockQty: product?.stockQty ?? 0,
    lowStockQty: product?.lowStockQty ?? 0,
    backorderable: product?.backorderable ?? false,
    leadTimeDays: product?.leadTimeDays != null ? String(product.leadTimeDays) : "",
    isActive: product?.isActive ?? true,
    fitmentScope: product?.fitmentScope ?? "universal",
    vehicleTypeIds: product?.vehicleTypeIds ?? [],
  }
}

function optionalNumber(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export function CatalogProductForm({
  product,
  brands,
}: {
  product?: CatalogProductFormData
  brands: CatalogBrandOption[]
}) {
  const router = useRouter()
  const isEdit = !!product
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [tecdocCategories, setTecdocCategories] = useState<TecdocCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  useEffect(() => {
    fetch("/api/admin/tecdoc-categories")
      .then((r) => r.json())
      .then((data) => {
        setTecdocCategories(data.categories || [])
        setLoadingCategories(false)
      })
      .catch(() => {
        setLoadingCategories(false)
      })
  }, [])

  const form = useForm<BakimxProductFormValues, unknown, BakimxProductFormValues>({
    resolver: typedResolver(bakimxProductFormSchema),
    defaultValues: toDefaults(product),
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const priceLira = Number(form.watch("workshopPrice")) || 0
  const vatPercent = Number(form.watch("vatRate")) || 0
  const grossLabel = formatKurus(grossFromNetKurus(liraToKurus(priceLira), percentToBps(vatPercent)))

  function onSubmit(values: BakimxProductFormValues) {
    setError(null)
    const leadTimeDays = optionalNumber(values.leadTimeDays)
    const costLira = optionalNumber(values.costPrice)

    const payload = {
      sku: values.sku,
      name: values.name,
      brandId: values.brandId,
      categoryKey: values.categoryKey,
      tecdocCategoryId: values.tecdocCategoryId,
      barcode: values.barcode,
      unit: values.unit,
      description: values.description,
      imageUrl: values.imageUrl,
      oemNumbers: parseOemNumbers(values.oemNumbers),
      workshopPriceKurus: liraToKurus(Number(values.workshopPrice) || 0),
      vatRateBps: percentToBps(Number(values.vatRate) || 0),
      costPriceKurus: costLira == null ? null : liraToKurus(costLira),
      stockQty: Number(values.stockQty) || 0,
      lowStockQty: Number(values.lowStockQty) || 0,
      backorderable: values.backorderable,
      leadTimeDays: leadTimeDays == null ? null : Math.trunc(leadTimeDays),
      isActive: values.isActive,
      fitmentScope: values.fitmentScope,
      vehicleTypeIds: values.vehicleTypeIds,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateBakimxProductAction(product.id, payload)
        : await createBakimxProductAction(payload)

      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(isEdit ? "Ürün güncellendi" : "Ürün oluşturuldu")
      router.push(result.id ? `/admin/catalog/${result.id}` : "/admin/catalog")
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/catalog" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">{isEdit ? "Ürünü Düzenle" : "Yeni Ürün"}</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Ürün bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ürün kodu (SKU) *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="MUTLU-60AH" />
                    </FormControl>
                    <FormDescription>Katalogda benzersizdir; içe aktarımın eşleşme anahtarıdır.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ürün adı *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Mutlu Akü 60 Ah" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marka *</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Marka seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                              {!b.isActive && " (pasif)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BakımX kategorisi</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Kategori seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Kategorisiz</SelectItem>
                          {BAKIMX_CATEGORIES.map((c) => (
                            <SelectItem key={c.key} value={c.key}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tecdocCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TecDoc kategorisi</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                        disabled={loadingCategories}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={loadingCategories ? "Yükleniyor..." : "TecDoc kategorisi seçin"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Eşleştirilmiyor</SelectItem>
                          {tecdocCategories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>Ürün bu TecDoc kategorisinde de listelenir.</FormDescription>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Görsel adresi</FormLabel>
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
              name="oemNumbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OEM numaraları</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Virgül veya satır ile ayırın" />
                  </FormControl>
                  <FormDescription>Arama anahtarını besler; muadil eşleştirme Faz 2’de kullanılır.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Opsiyonel açıklama" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Fiyat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="workshopPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atölye alış fiyatı (KDV hariç) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" step="0.01" inputMode="decimal" />
                    </FormControl>
                    <FormDescription>Atölyenin BakımX’ten alış fiyatı — ₺, KDV hariç.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vatRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KDV oranı</FormLabel>
                    <FormControl>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="KDV" />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              %{rate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İç maliyet (₺)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" step="0.01" inputMode="decimal" placeholder="Opsiyonel" />
                    </FormControl>
                    <FormDescription>Yalnız BakımX görür; atölye yüzeyine çıkmaz.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              KDV dahil satır karşılığı: <span className="font-medium text-foreground tabular-nums">{grossLabel}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Stok ve görünürlük</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="stockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stok adedi</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" step="1" inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lowStockQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kritik stok eşiği</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" step="1" inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tedarik süresi (gün)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" step="1" inputMode="numeric" placeholder="Opsiyonel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="backorderable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <FormLabel>Siparişe açık</FormLabel>
                    <FormDescription>Stok 0 olsa da ürün “siparişe açık” gösterilir.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <FormLabel>Aktif</FormLabel>
                    <FormDescription>Pasif ürünler atölye yüzeyinde listelenmez.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Araç kapsamı (BAK-46)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="fitmentScope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapsam</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="universal">Tüm araçlar (varsayılan)</SelectItem>
                        <SelectItem value="vehicle_linked">Seçili araçlar</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    &quot;Tüm araçlar&quot;: her araçta görünür. &quot;Seçili araçlar&quot;: yalnız eşlenmiş araçlarda.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("fitmentScope") === "vehicle_linked" && (
              <div className="space-y-2">
                <VehicleTypeSelector
                  selectedIds={form.watch("vehicleTypeIds")}
                  onChange={(ids) => form.setValue("vehicleTypeIds", ids)}
                />
                {form.watch("vehicleTypeIds").length === 0 && (
                  <p className="text-sm text-destructive-strong">
                    ⚠️ Hiçbir araç seçilmedi. Ürün kaydedilirse hiçbir yerde görünmez.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {isEdit ? "Güncelle" : "Ürünü oluştur"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/catalog">
              İptal
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  )
}
