"use client"

import { useState, useCallback, useEffect, useActionState, startTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Loader2, Calculator, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { QuoteItemsEditor } from "@/components/quotes/quote-items-editor"
import { cn } from "@/lib/utils"
import { createQuoteAction } from "@/app/(app)/quotes/actions"
import { formatTRY } from "@/lib/format"
import { liraToKurus, percentToBps } from "@/lib/money"
import { calculateOrderTotals } from "@/lib/totals"
import type { LaborCatalogRow } from "@/lib/labor/types"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  quoteSchema,
  type QuoteFormValues,
} from "@/lib/validations/quote"

// Katalog/motor alanları TecDoc araması için gerekli (PickerVehicle ile aynı
// şekil) — /api/customers/[id]/vehicles bunları döner.
type Vehicle = {
  id: string
  plate: string
  brand: string
  model: string
  catalogVehicleTypeId: number | null
  vin: string | null
  modelYear: number | null
  engineDisplacement: string | null
  enginePower: string | null
  fuelType: string | null
  firstRegistrationDate: string | null
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

export function QuoteCreateForm({ laborCatalog }: { laborCatalog: LaborCatalogRow[] }) {
  const router = useRouter()
  const wrappedAction = async (
    _prev: ActionState | null,
    formData: FormData,
  ): Promise<ActionState | null> => {
    return createQuoteAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null as ActionState | null)
  const [customerLabel, setCustomerLabel] = useState("")
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"draft" | "sent">("sent")

  const form = useForm<QuoteFormValues, unknown, QuoteFormValues>({
    resolver: typedResolver(quoteSchema),
    defaultValues: {
      customerId: "",
      vehicleId: "",
      title: "",
      customerRequest: "",
      internalNote: "",
      validUntil: "",
      status: "draft",
      discountAmount: "0",
      taxRate: "20",
      items: [],
    },
  })

  const customerId = form.watch("customerId")
  const vehicleId = form.watch("vehicleId")
  const discountAmount = form.watch("discountAmount")
  const taxRate = form.watch("taxRate")
  const itemsWatch = form.watch("items")
  // Seçili araç kayıtlıysa kalem düzenleyicisi araca uygun katalog aramasını açar.
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/quotes/${state.id}`)
    }
  }, [state, router])

  const fetchVehicles = useCallback(async (custId: string) => {
    setVehicleLoading(true)
    form.setValue("vehicleId", "")
    try {
      const res = await fetch(`/api/customers/${custId}/vehicles`)
      const data = await res.json()
      if (data.vehicles) setVehicles(data.vehicles)
      else setVehicles([])
    } catch {
      setVehicles([])
    } finally {
      setVehicleLoading(false)
    }
  }, [form])

  function handleCustomerSelect(id: string, label: string) {
    form.setValue("customerId", id)
    setCustomerLabel(label)
    fetchVehicles(id)
  }

  function clearCustomer() {
    form.setValue("customerId", "")
    form.setValue("vehicleId", "")
    setCustomerLabel("")
    setVehicles([])
  }

  // PREVIEW ONLY — the server recomputes the authoritative totals from the line
  // items. Kalem tutarları zaten kuruş (#179); yalnız indirim/KDV alanları hâlâ
  // TL/yüzde girildiği için burada çevrilir. Aynı money modülü sunucuda da
  // çalıştığı için önizleme kaydedilen sonuçla birebir örtüşür.
  const preview = calculateOrderTotals(
    itemsWatch.map((i) => ({
      type: i.type,
      name: i.name,
      quantity: Number(i.quantity) || 0,
      unitPrice: i.unitPrice ?? null,
      totalPrice: i.totalPrice ?? null,
    })),
    {
      discountAmount: liraToKurus(Math.max(0, Number(discountAmount) || 0)),
      taxRate: percentToBps(Number(taxRate) || 0),
    }
  )
  const partsTotal = preview.partsTotal
  const laborTotal = preview.laborTotal
  const subtotal = preview.subtotal
  const discount = preview.discountAmount
  const tax = preview.taxAmount
  const grandTotal = preview.grandTotal

  function onSubmit(values: QuoteFormValues) {
    if (!values.customerId) return
    const formData = new FormData()
    formData.set("customerId", values.customerId)
    formData.set("vehicleId", values.vehicleId || "")
    formData.set("title", values.title || "")
    formData.set("customerRequest", values.customerRequest || "")
    formData.set("internalNote", values.internalNote || "")
    formData.set("validUntil", values.validUntil || "")
    // Convert TRY (lira) inputs to integer kuruş and the percent rate to bps;
    // the server is authoritative for totals, so estimated*/grandTotal are not sent.
    formData.set("discountAmount", String(liraToKurus(Math.max(0, Number(values.discountAmount) || 0))))
    formData.set("taxRate", String(percentToBps(Number(values.taxRate) || 0)))
    formData.set("status", submitStatus)
    const cleanItems = values.items
      .filter((i) => i.name.trim())
      .map((i) => ({
        type: i.type,
        name: i.name,
        sku: i.sku || undefined,
        unit: i.unit || undefined,
        quantity: i.quantity,
        // Kuruş — form ile sunucu aynı birimi konuşuyor, çevrim yok.
        unitPrice: i.unitPrice != null && i.unitPrice > 0 ? i.unitPrice : undefined,
        totalPrice: i.totalPrice != null && i.totalPrice > 0 ? i.totalPrice : undefined,
        note: i.note || undefined,
        partId: i.partId || undefined,
      }))
    formData.set("items", JSON.stringify(cleanItems))
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Müşteri & Araç</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri (sahip) *</FormLabel>
                      <FormControl>
                        <div>
                          <input type="hidden" ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} />
                          {field.value && customerLabel ? (
                            <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                              <span className="flex items-center gap-2 text-sm font-medium">
                                <User className="size-4 text-primary" /> {customerLabel}
                              </span>
                              <Button type="button" size="icon-sm" variant="ghost" onClick={clearCustomer} aria-label="Müşteriyi değiştir">
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <CustomerSearchOrCreate onSelected={handleCustomerSelect} />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Araç</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={vehicleLoading ? "Yükleniyor..." : "Araç seçin (isteğe bağlı)"}>
                              {(value: string | null) => {
                                if (!value) return null
                                const v = vehicles.find((v) => v.id === value)
                                return v ? `${v.plate} — ${v.brand} ${v.model}` : value
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.plate} — {v.brand} {v.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {customerId && (
                  <div className="flex items-center gap-3 text-xs">
                    <Button
                      nativeButton={false}
                      variant="link"
                      size="xs"
                      className="h-auto p-0"
                      render={<Link href={`/vehicles/new?customerId=${customerId}`} />}
                    >
                      + Yeni Araç
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Teklif Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teklif Başlığı</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Örn: Periyodik Bakım Teklifi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerRequest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Talebi</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Müşterinin belirttiği istek veya şikayetler..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geçerlilik Tarihi</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="internalNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İç Not</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="İç kullanım notu (müşteriye gösterilmez)..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Parça &amp; İşçilik Kalemleri</CardTitle>
              </CardHeader>
              <CardContent>
                {/* #179 — iş emri detayındaki kalem deneyiminin aynısı: katalogdan
                    (araç seçiliyse TecDoc) arayarak VEYA elle kalem ekleme, tür
                    ayrımı, miktar/birim fiyat/toplam düzenleme. Teklif tarafı
                    sunucuya YAZMAZ; satırlar forma yansır (bkz. QuoteItemsEditor). */}
                <FormField
                  control={form.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div>
                          <QuoteItemsEditor
                            value={field.value}
                            onChange={field.onChange}
                            vehicle={selectedVehicle}
                            laborCatalog={laborCatalog}
                            disabled={pending}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <div className="lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calculator className="size-4 text-muted-foreground" />
                    Fiyat Özeti
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <SummaryRow label="Parça Toplamı" value={partsTotal > 0 ? formatTRY(partsTotal) : "—"} muted={partsTotal === 0} />
                  <SummaryRow label="İşçilik Toplamı" value={laborTotal > 0 ? formatTRY(laborTotal) : "—"} muted={laborTotal === 0} />
                  <div className="pt-2 border-t" />
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] text-muted-foreground">İndirim (₺)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] text-muted-foreground">KDV Oranı (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...field}
                              placeholder="20"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <SummaryRow label="İndirim" value={discount > 0 ? `-${formatTRY(discount)}` : "—"} muted={discount === 0} />
                  <SummaryRow label={`KDV (%${Number(taxRate) || 0})`} value={tax > 0 ? formatTRY(tax) : "—"} muted={tax === 0} />
                  <div className="border-t pt-2 mt-2">
                    <SummaryRow label="Genel Toplam" value={subtotal > 0 ? formatTRY(grandTotal) : "—"} bold large />
                  </div>
                </CardContent>
              </Card>

              <div className="hidden lg:flex flex-col gap-2 mt-5">
                <Button
                  type="submit"
                  disabled={pending}
                  className="gap-2 w-full"
                  onClick={() => setSubmitStatus("sent")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Teklif Kaydet
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  className="gap-2 w-full"
                  onClick={() => setSubmitStatus("draft")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Taslak Kaydet
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                  disabled={pending}
                  className="w-full"
                >
                  İptal
                </Button>
              </div>
            </div>
          </aside>
        </div>

        <div className="lg:hidden mt-4 border-t border-border pt-4 flex gap-2">
          <Button
            type="submit"
            disabled={pending}
            className="flex-1 gap-2"
            onClick={() => setSubmitStatus("sent")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Kaydet
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending} className="flex-1">
            İptal
          </Button>
        </div>
      </form>
    </Form>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(muted ? "text-muted-foreground/70" : "text-foreground", large && "text-lg font-bold text-foreground")}>
        {value}
      </span>
    </div>
  )
}